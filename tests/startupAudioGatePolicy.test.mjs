import assert from "node:assert/strict";
import test from "node:test";

import {
  canReleasePlayingNativeStartupAudioGate,
  selectStartupAudioFallbackOption
} from "../js/core/player/startupAudioGatePolicy.js";

test("playing native startup gate releases only after a presented playable frame", () => {
  assert.equal(
    canReleasePlayingNativeStartupAudioGate({
      allowNativePlayback: true,
      hasPresentedPlaybackFrame: true,
      readyState: 3
    }),
    true
  );
  assert.equal(
    canReleasePlayingNativeStartupAudioGate({
      allowNativePlayback: false,
      hasPresentedPlaybackFrame: true,
      readyState: 3
    }),
    false
  );
  assert.equal(
    canReleasePlayingNativeStartupAudioGate({
      allowNativePlayback: true,
      hasPresentedPlaybackFrame: false,
      readyState: 3
    }),
    false
  );
  assert.equal(
    canReleasePlayingNativeStartupAudioGate({
      allowNativePlayback: true,
      hasPresentedPlaybackFrame: true,
      readyState: 2
    }),
    false
  );
  assert.equal(
    canReleasePlayingNativeStartupAudioGate({
      allowNativePlayback: true,
      hasPresentedPlaybackFrame: true,
      pendingAudioSelection: true,
      readyState: 4
    }),
    false
  );
});

test("startup fallback keeps the supported track already selected by webOS", () => {
  const selected = { id: "selected", selected: true, supported: true };
  const options = [{ id: "first", selected: false, supported: true }, selected];

  assert.equal(selectStartupAudioFallbackOption(options), selected);
});

test("startup fallback skips unsupported tracks and otherwise uses the first supported track", () => {
  const supported = { id: "supported", selected: false, supported: true };
  assert.equal(
    selectStartupAudioFallbackOption([
      { id: "unsupported-selected", selected: true, supported: false },
      supported
    ]),
    supported
  );
  assert.equal(selectStartupAudioFallbackOption([]), null);
});
