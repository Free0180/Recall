package com.free0180.petvocab;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String APP_URL = "https://free0180.github.io/Recall/";
    private static final String APP_HOST = "free0180.github.io";
    private static final String APP_PATH = "/Recall";
    private static final int FILE_CHOOSER_REQUEST = 1904;

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileSelection;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        configureWebView(webView);
        setContentView(webView);

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " PETVocabHuawei/1.0");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(view, true);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView currentView, WebResourceRequest request) {
                return openExternalPageIfNeeded(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView currentView, String url) {
                return openExternalPageIfNeeded(Uri.parse(url));
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView currentView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (pendingFileSelection != null) {
                    pendingFileSelection.onReceiveValue(null);
                }
                pendingFileSelection = filePathCallback;

                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException error) {
                    pendingFileSelection = null;
                    Toast.makeText(MainActivity.this, "未找到可选择文件的应用", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
    }

    private boolean openExternalPageIfNeeded(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || scheme.equals("about") || scheme.equals("data") || scheme.equals("blob")) {
            return false;
        }

        String path = uri.getPath();
        boolean isAppPage = "https".equalsIgnoreCase(scheme)
                && APP_HOST.equalsIgnoreCase(uri.getHost())
                && path != null
                && (path.equals(APP_PATH) || path.startsWith(APP_PATH + "/"));
        if (isAppPage) {
            return false;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "无法打开此链接", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileSelection == null) {
            return;
        }

        Uri[] selectedFiles = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        pendingFileSelection.onReceiveValue(selectedFiles);
        pendingFileSelection = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (pendingFileSelection != null) {
            pendingFileSelection.onReceiveValue(null);
            pendingFileSelection = null;
        }
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }
}
