// All app resources, we don't need to cache-bust these since we re-download on install
appResources = [
      "tw.js",
      "polyfill.js",
      // *.html
      "coin.html",
      "quiz.html",
      "start.html",
      // *.css
      "libraries.0.css",
      "quiz.css",
      // *.jpg
      "logo.jpg",
];
// All probably mathjax resources
mathJaxResources = [
      "mathjax-config.js",
      "mathjax/MathJax.js",
      "mathjax/MathJax.js?config=../../mathjax-config.js",
      "mathjax/extensions/tex2jax.js?rev=2.6.1",
      "mathjax/extensions/MathMenu.js?rev=2.6.1",
      "mathjax/extensions/MathZoom.js?rev=2.6.1",
      "mathjax/extensions/MathEvents.js",
      "mathjax/extensions/TeX/AMSmath.js",
      "mathjax/extensions/TeX/AMSsymbols.js",
      "mathjax/extensions/TeX/noErrors.js",
      "mathjax/extensions/TeX/noUndefined.js",
      "mathjax/extensions/TeX/cancel.js",
      "mathjax/jax/input/TeX/config.js?rev=2.6.1",
      "mathjax/jax/input/TeX/jax.js",
      "mathjax/jax/output/HTML-CSS/config.js?rev=2.6.1",
      "mathjax/jax/output/HTML-CSS/imageFonts.js",
      "mathjax/jax/output/HTML-CSS/jax.js",
      "mathjax/jax/output/HTML-CSS/autoload/annotation-xml.js",
      "mathjax/jax/output/HTML-CSS/autoload/maction.js",
      "mathjax/jax/output/HTML-CSS/autoload/menclose.js",
      "mathjax/jax/output/HTML-CSS/autoload/mglyph.js",
      "mathjax/jax/output/HTML-CSS/autoload/mmultiscripts.js",
      "mathjax/jax/output/HTML-CSS/autoload/ms.js",
      "mathjax/jax/output/HTML-CSS/autoload/mtable.js",
      "mathjax/jax/output/HTML-CSS/autoload/multiline.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/fontdata.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/fontdata-extra.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Arrows.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/BBBold.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/BoxDrawing.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Dingbats.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/EnclosedAlphanum.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GeneralPunctuation.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GeometricShapes.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GreekAndCoptic.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Latin1Supplement.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/LatinExtendedA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/LetterlikeSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MathOperators.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscMathSymbolsB.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscTechnical.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/PUA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/SpacingModLetters.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/SuppMathOperators.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Caligraphic/Bold/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Caligraphic/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/PUA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/PUA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/BoldItalic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Bold/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Italic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Arrows.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/CombDiactForSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/GeneralPunctuation.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/GeometricShapes.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Latin1Supplement.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LatinExtendedA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LatinExtendedB.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LetterlikeSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MathOperators.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscMathSymbolsA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscTechnical.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SpacingModLetters.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SupplementalArrowsA.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SuppMathOperators.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/GeneralPunctuation.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/Latin1Supplement.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/LetterlikeSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/GeometricShapes.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/MiscSymbols.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/SpacingModLetters.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Math/BoldItalic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Math/Italic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Size1/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Size2/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Size3/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Size4/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/BasicLatin.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/CombDiacritMarks.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/Other.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/WinChrome/Regular/Main.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/AMS.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/Bold.js",
      "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/Main.js",
      "mathjax/jax/output/NativeMML/config.js?rev=2.6.1",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_AMS-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Caligraphic-Bold.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Caligraphic-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Fraktur-Bold.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Fraktur-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Bold.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Italic.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-BoldItalic.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-Italic.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Bold.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Italic.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Script-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size1-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size2-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size3-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size4-Regular.woff",
      "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Typewriter-Regular.woff",
      "mathjax/jax/element/mml/jax.js",
];
const addResourcesToCache = async (resources) => {
  const cache = await caches.open('v1');
  await cache.addAll(resources);
};

const putInCache = async (request, response) => {
  const cache = await caches.open('v1');
  await cache.put(request, response);
};

const cacheFirst = async ({ request, preloadResponsePromise, fallbackUrl }) => {
  // Try to get the resource from the cache
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
    return responseFromCache;
  }

  // Try to use the preloaded response, if it's there
  const preloadResponse = await preloadResponsePromise;
  if (preloadResponse) {
    putInCache(request, preloadResponse.clone());
    return preloadResponse;
  }

  // Next try to get the resource from the network
  try {
    const responseFromNetwork = await fetch(request);
    // response may be used only once
    // we need to save clone to put one copy in cache
    // and serve second one
    putInCache(request, responseFromNetwork.clone());
    return responseFromNetwork;
  } catch (error) {
    const fallbackResponse = await caches.match(fallbackUrl);
    if (fallbackResponse) {
      return fallbackResponse;
    }
    // when even the fallback response is not available,
    // there is nothing we can do, but we must always
    // return a Response object
    return new Response('Network error happened', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};

self.addEventListener('activate', (event) => {
  // Scrub app cache so we install new versions in the next step
  caches.delete("v1");
});

self.addEventListener('install', (event) => {
  event.waitUntil(addResourcesToCache(appResources));
  event.waitUntil(addResourcesToCache(mathJaxResources));

  // Just install the new serviceWorker, don't wait until pages are closed
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Don't cache API calls
  if (event.request.url.indexOf('/quizdb') > -1 || event.request.url.indexOf('/@@quizdb') > -1) {
      return;
  }

  event.respondWith(
    cacheFirst({
      request: event.request,
      preloadResponsePromise: event.preloadResponse,
    })
  );
});

// MD5: f0c50af5cd2b1e5dd80ed4a34909598e
