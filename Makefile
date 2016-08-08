GIT = git
NPM = npm
NODEJS = node

NODE_PATH = node_modules

all: install_dependencies test lint tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/tw.appcache

pre_commit: lint tutorweb/quiz/resources/tw.js

test: install_dependencies
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/run-tests.js

coverage: install_dependencies
	NODE_PATH=$(NODE_PATH) $(NODEJS) node_modules/istanbul/lib/cli.js cover tests/run-tests.js

lint:
	$(NODEJS) node_modules/jslint/bin/jslint lib/*.js

install_dependencies:: repo_hooks
	NODE_PATH=$(NODE_PATH) $(NPM) install

repo_hooks:
	(cd .git/hooks/ && ln -sf ../../hooks/pre-commit pre-commit)

tutorweb/quiz/resources/tw.appcache: tutorweb/quiz/resources/*.html tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/polyfill.js tutorweb/quiz/resources/mathjax-config.js tutorweb/quiz/resources/*.css tutorweb/quiz/resources/*.jpg
	@echo "CACHE MANIFEST\n" > $@
	@for f in $+; do basename $$f; done >> $@
	@echo "mathjax/MathJax.js" >> $@
	@echo "mathjax/MathJax.js?config=../../mathjax-config.js" >> $@
	@echo "mathjax/extensions/tex2jax.js" >> $@
	@echo "mathjax/extensions/MathMenu.js" >> $@
	@echo "mathjax/extensions/MathZoom.js" >> $@
	@echo "mathjax/extensions/MathEvents.js" >> $@
	@echo "mathjax/extensions/TeX/AMSmath.js" >> $@
	@echo "mathjax/extensions/TeX/AMSsymbols.js" >> $@
	@echo "mathjax/extensions/TeX/noErrors.js" >> $@
	@echo "mathjax/extensions/TeX/noUndefined.js" >> $@
	@echo "mathjax/extensions/TeX/cancel.js" >> $@
	@echo "mathjax/jax/input/TeX/config.js" >> $@
	@echo "mathjax/jax/input/TeX/jax.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/config.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/imageFonts.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/jax.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/annotation-xml.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/maction.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/menclose.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/mglyph.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/mmultiscripts.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/ms.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/mtable.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/autoload/multiline.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/fontdata.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/fontdata-extra.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Arrows.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/BBBold.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/BoxDrawing.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Dingbats.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/EnclosedAlphanum.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GeneralPunctuation.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GeometricShapes.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/GreekAndCoptic.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Latin1Supplement.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/LatinExtendedA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/LetterlikeSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MathOperators.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscMathSymbolsB.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/MiscTechnical.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/PUA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/SpacingModLetters.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/AMS/Regular/SuppMathOperators.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Caligraphic/Bold/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Caligraphic/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Bold/PUA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Fraktur/Regular/PUA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/BoldItalic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Bold/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Italic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Greek/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Arrows.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/CombDiactForSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/GeneralPunctuation.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/GeometricShapes.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Latin1Supplement.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LatinExtendedA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LatinExtendedB.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/LetterlikeSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MathOperators.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscMathSymbolsA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/MiscTechnical.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SpacingModLetters.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SupplementalArrowsA.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Bold/SuppMathOperators.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/GeneralPunctuation.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/Latin1Supplement.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/LetterlikeSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Italic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/GeometricShapes.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/MiscSymbols.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Main/Regular/SpacingModLetters.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Math/BoldItalic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Math/Italic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Bold/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Italic/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/SansSerif/Regular/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Script/Regular/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Size1/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Size2/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Size3/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Size4/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/BasicLatin.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/CombDiacritMarks.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/Typewriter/Regular/Other.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/WinChrome/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/AMS.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/Bold.js" >> $@
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/WinIE6/Regular/Main.js" >> $@
	@echo "mathjax/jax/output/NativeMML/config.js" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_AMS-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Caligraphic-Bold.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Caligraphic-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Fraktur-Bold.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Fraktur-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Bold.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Italic.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Main-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-BoldItalic.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-Italic.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Math-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Bold.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Italic.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_SansSerif-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Script-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size1-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size2-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size3-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Size4-Regular.woff" >> $@
	@echo "mathjax/fonts/HTML-CSS/TeX/woff/MathJax_Typewriter-Regular.woff" >> $@
	@echo "mathjax/jax/element/mml/jax.js" >> $@
	@echo "" >> $@
	@echo "NETWORK:\n" >> $@
	@echo "*" >> $@
	@echo "" >> $@
	@echo -n "# " >> $@
	@cat $+ | md5sum | cut -d' ' -f1 >> $@

# NB: We use .js.map.js here, so Python interprets as application/javascript
# and Diazo doesn't XHTMLify. We could add to /etc/mime.types but that's unfriendly
# to other developers
tutorweb/quiz/resources/tw.js: lib/*.js lib/standalone/*.js
	(cd tutorweb/quiz/resources/ && ln -sf ../../../lib .)
	(cd tutorweb/quiz/resources/ && ln -sf ../../../node_modules .)
	$(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js --debug \
	    lib/*.js lib/standalone/*.js \
	    | $(NODEJS) $(NODE_PATH)/exorcist/bin/exorcist.js \
	        tutorweb/quiz/resources/tw.uncompressed.js.map.js \
	    > tutorweb/quiz/resources/tw.uncompressed.js
	$(NODEJS) $(NODE_PATH)/uglify-js/bin/uglifyjs \
	    tutorweb/quiz/resources/tw.uncompressed.js \
	    --in-source-map tutorweb/quiz/resources/tw.uncompressed.js.map.js \
	    --source-map tutorweb/quiz/resources/tw.js.map.js \
	    --source-map-url tw.js.map.js \
	    > tutorweb/quiz/resources/tw.js
	rm tutorweb/quiz/resources/tw.uncompressed*

webserver: tutorweb/quiz/resources/tw.js
	git submodule update --init
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/html/server.js

.PHONY: pre_commit test coverage lint install_dependencies repo_hooks watch webserver
