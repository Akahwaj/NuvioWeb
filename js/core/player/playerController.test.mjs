import assert from "node:assert/strict";
import test from "node:test";

import { PlayerController } from "./playerController.js";

function createController(renderMode) {
  const calls = [];
  const avplay = {
    setSilentSubtitle(silent) {
      calls.push(["setSilentSubtitle", silent]);
    },
    setSelectTrack(type, index) {
      calls.push(["setSelectTrack", type, index]);
    }
  };
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    avplaySubtitleRenderMode: renderMode,
    avplaySubtitleTracks: [{ avplayTrackIndex: 4 }],
    getAvPlay: () => avplay,
    getAvPlayState: () => "PLAYING",
    reapplyTizenAvPlayDisplayRect() {}
  });
  return { calls, controller };
}

test("AVPlay re-arms native subtitles before selecting a track", () => {
  const { calls, controller } = createController("native");

  assert.equal(controller.trySelectAvPlaySubtitleTrackIndex(4), true);
  assert.deepEqual(calls, [
    ["setSilentSubtitle", true],
    ["setSelectTrack", "TEXT", 4],
    ["setSilentSubtitle", false]
  ]);
  assert.equal(controller.avplaySubtitlesSilent, false);
  assert.equal(controller.avplayNativeSubtitleRendering, true);
});

test("AVPlay re-arms HTML subtitle callbacks before selecting a track", () => {
  const { calls, controller } = createController("html");

  assert.equal(controller.trySelectAvPlaySubtitleTrackIndex(4), true);
  assert.deepEqual(calls, [
    ["setSilentSubtitle", false],
    ["setSelectTrack", "TEXT", 4],
    ["setSilentSubtitle", true]
  ]);
  assert.equal(controller.avplaySubtitlesSilent, false);
  assert.equal(controller.avplayNativeSubtitleRendering, false);
});

test("AVPlay forced subtitle retry reselects an already reported track", () => {
  const { calls, controller } = createController("native");
  controller.getCurrentAvPlaySubtitleTrackIndex = () => 4;

  assert.equal(
    controller.retryAvPlaySubtitleTrackSelection(4, {
      force: true,
      renderMode: "native"
    }),
    true
  );
  assert.deepEqual(calls, [
    ["setSilentSubtitle", true],
    ["setSelectTrack", "TEXT", 4],
    ["setSilentSubtitle", false]
  ]);
});

test("AVPlay normal subtitle retry does not reselect an active track", () => {
  const { calls, controller } = createController("native");
  controller.getCurrentAvPlaySubtitleTrackIndex = () => 4;

  assert.equal(controller.retryAvPlaySubtitleTrackSelection(4), true);
  assert.deepEqual(calls, [["setSilentSubtitle", false]]);
});

test("returning from disabled subtitles forces only the bounded AVPlay retries", () => {
  const { controller } = createController("native");
  const retries = [];
  const originalSetTimeout = globalThis.setTimeout;
  Object.assign(controller, {
    avplaySubtitlesSilent: true,
    avplaySubtitleSelectionToken: 0,
    isUsingAvPlay: () => true,
    syncAvPlayTrackInfo() {},
    emitVideoEvent() {},
    retryAvPlaySubtitleTrackSelection(trackIndex, options) {
      retries.push([trackIndex, options]);
      return true;
    }
  });
  globalThis.setTimeout = (callback, delayMs) => {
    callback();
    return delayMs;
  };

  try {
    assert.equal(controller.setAvPlaySubtitleTrack(4), true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.deepEqual(retries, [
    [4, { force: true, renderMode: "native" }],
    [4, { force: true, renderMode: "native" }]
  ]);
});

test("AVPlay audio track selection does not seek after switching", () => {
  const calls = [];
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    avplayAudioTracks: [{ avplayTrackIndex: 2 }],
    getAvPlay: () => ({
      setSelectTrack(type, index) {
        calls.push(["setSelectTrack", type, index]);
      },
      seekTo(position) {
        calls.push(["seekTo", position]);
      }
    }),
    getAvPlayState: () => "PLAYING"
  });

  assert.equal(controller.trySelectAvPlayAudioTrackIndex(2), true);
  assert.deepEqual(calls, [["setSelectTrack", "AUDIO", 2]]);
});

test("queued AVPlay startup audio selection retries while its deadline is active", () => {
  let attempts = 0;
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    pendingAvPlayAudioTrackIndex: 2,
    desiredAvPlayAudioTrackUntil: Date.now() + 5000,
    applyPendingAvPlayAudioTrackSelection() {
      attempts += 1;
      return true;
    }
  });

  assert.equal(controller.retryPendingAvPlayStartupAudioTrackSelection(), true);
  assert.equal(attempts, 1);
});

test("expired AVPlay startup audio selection is discarded", () => {
  let attempts = 0;
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    pendingAvPlayAudioTrackIndex: 2,
    desiredAvPlayAudioTrackUntil: Date.now() - 1,
    applyPendingAvPlayAudioTrackSelection() {
      attempts += 1;
      return true;
    }
  });

  assert.equal(controller.retryPendingAvPlayStartupAudioTrackSelection(), false);
  assert.equal(controller.pendingAvPlayAudioTrackIndex, -1);
  assert.equal(attempts, 0);
});

test("AVPlay uses Android-aligned start and resume buffering limits", () => {
  const calls = [];
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    getAvPlay: () => ({
      setBufferingParam(option, unit, seconds) {
        calls.push(["setBufferingParam", option, unit, seconds]);
      },
      setTimeoutForBuffering(seconds) {
        calls.push(["setTimeoutForBuffering", seconds]);
      }
    })
  });

  controller.configureAvPlayBuffering();

  assert.deepEqual(calls, [
    ["setBufferingParam", "PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", 5],
    ["setBufferingParam", "PLAYER_BUFFER_FOR_RESUME", "PLAYER_BUFFER_SIZE_IN_SECOND", 4],
    ["setTimeoutForBuffering", 10]
  ]);
});

test("unsupported AVPlay buffering controls do not abort source setup", () => {
  let timeoutSeconds = 0;
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    getAvPlay: () => ({
      setBufferingParam() {
        throw new Error("NotSupportedError");
      },
      setTimeoutForBuffering(seconds) {
        timeoutSeconds = seconds;
      }
    })
  });

  assert.doesNotThrow(() => controller.configureAvPlayBuffering());
  assert.equal(timeoutSeconds, 10);
});

test("movie progress identity is independent from the selected source", () => {
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    currentItemId: "tt123",
    currentItemType: "movie",
    currentVideoId: "addon-specific-video-id"
  });

  assert.equal(controller.createProgressContext().videoId, null);
});

test("series progress keeps the exact episode video identity", () => {
  const controller = Object.create(PlayerController);
  Object.assign(controller, {
    currentItemId: "tt123",
    currentItemType: "series",
    currentVideoId: "tt123:1:2",
    currentSeason: 1,
    currentEpisode: 2
  });

  const context = controller.createProgressContext();
  assert.equal(context.videoId, "tt123:1:2");
  assert.equal(context.season, 1);
  assert.equal(context.episode, 2);
});
