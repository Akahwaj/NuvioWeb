import UIKit
import WebKit

/// Full-screen WKWebView wrapper around the hosted AnimeWorld web app.
/// Falls back to a bundled offline copy (ios/web/) when the hosted site
/// cannot be reached.
final class ViewController: UIViewController {

    // MARK: - Configuration

    /// Single source of truth for the hosted web app location.
    private static let HOSTED_URL = URL(string: "https://akahwaj.github.io/")!

    // MARK: - Private

    private var webView: WKWebView!
    private var fullscreenObservation: NSKeyValueObservation?
    private var didLoadOfflineFallback = false

    // MARK: - View lifecycle

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.isOpaque = false
        webView.navigationDelegate = self

        self.webView = webView
        self.view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        observeFullscreenState()
        loadHostedApp()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    // MARK: - Loading

    private func loadHostedApp() {
        webView.load(URLRequest(url: Self.HOSTED_URL))
    }

    /// Loads the bundled offline copy shipped in the app under `web/`.
    /// `allowingReadAccessTo` grants the page access to sibling assets
    /// (js/, css/, images) inside the web folder.
    private func loadOfflineFallback() {
        guard !didLoadOfflineFallback else { return }
        didLoadOfflineFallback = true
        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            showOfflineError()
            return
        }
        let webDirectory = indexURL.deletingLastPathComponent()
        webView.loadFileURL(indexURL, allowingReadAccessTo: webDirectory)
    }

    private func showOfflineError() {
        let html = """
        <html><body style="background:#000;color:#fff;font-family:-apple-system;\
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <p>AnimeWorld is unavailable offline.<br>Please check your connection and reopen the app.</p>
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: - Fullscreen video

    /// Keeps the screen awake while media is playing in fullscreen.
    private func observeFullscreenState() {
        fullscreenObservation = webView.observe(\.fullscreenState, options: [.initial, .new]) { [weak self] webView, _ in
            let inFullscreen = webView.fullscreenState != .notInFullscreen
            self?.setIdleTimerDisabled(inFullscreen)
        }
    }

    private func setIdleTimerDisabled(_ disabled: Bool) {
        UIApplication.shared.isIdleTimerDisabled = disabled
    }
}

// MARK: - WKNavigationDelegate

extension ViewController: WKNavigationDelegate {

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        loadOfflineFallback()
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        // Ignore cancellations (e.g. user tapped a link mid-load).
        let nsError = error as NSError
        guard nsError.domain != NSURLErrorDomain || nsError.code != NSURLErrorCancelled else { return }
        loadOfflineFallback()
    }
}
