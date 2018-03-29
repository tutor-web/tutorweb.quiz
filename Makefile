GIT = git
YARN = yarn
NODE = node
NODE != which node || which nodejs
NODE_CMD = NODE_PATH="$(CURDIR)" $(NODE)

OUTPUTS := app preview stage

OUT_FILES = \
    $(foreach O,$(OUTPUTS),www/$(O).html www/js/$(O).min.js www/css/$(O).min.css) \
    www/js/polyfill.min.js \
    www/js/libraries.min.js \
    www/css/libraries.min.css \

LIBRARIES_JS = \
    jquery \

LIBRARIES_CSS = \
    lib/usermenu.css \
    node_modules/bootstrap/dist/css/bootstrap-reboot.min.css \
    node_modules/bootstrap/dist/css/bootstrap-grid.min.css \

all: test lint compile

compile: node_modules/ $(OUT_FILES)

test: node_modules/
	yarn run tape tests/test_*.js

coverage: node_modules/
	yarn run istanbul cover node_modules/tape/bin/tape tests/test_*.js

lint: node_modules/
	yarn run jslint $(foreach O,$(OUTPUTS) lib,$(O)/*.js)

clean:
	rm -r -- "node_modules"
	rm -- www/js/*.min.js www/css/*.min.css

watch:
	while inotifywait -r $(OUTPUTS); do make compile; done

node_modules/: package.json yarn.lock
	git submodule update --init
	$(YARN)
	touch node_modules/

yarn.lock:
	touch $@

www/js/libraries.min.js: package.json
	mkdir -p www/js
	(cd www/js && ln -sf ../../node_modules .)
	$(NODE_CMD) node_modules/browserify/bin/cmd.js \
	        $(foreach l,$(LIBRARIES_JS),-r $(l)) \
	    | $(NODE_CMD) node_modules/uglify-js/bin/uglifyjs \
	        --compress --mangle "reserved=['$$','require','exports']" \
	        --output $@.mktmp
	mv $@.mktmp $@

www/css/libraries.min.css: package.json
	mkdir -p www/css
	cat $(LIBRARIES_CSS) > $@.mktmp
	mv $@.mktmp $@

www/js/%.min.js: package.json %/*.js lib/*.js
	mkdir -p www/js
	(cd www/js && ln -sf ../../$(basename $(basename $(notdir $@))) .)
	$(NODE_CMD) node_modules/browserify/bin/cmd.js --debug \
	        $(foreach l,$(LIBRARIES_JS),-x $(l)) \
	        $(basename $(basename $(notdir $@)))/index.js \
	    | $(NODE_CMD) node_modules/uglify-js/bin/uglifyjs \
	        --compress --mangle "reserved=['$$','require','exports']" \
	        --source-map "content='inline',url='$(notdir $@).map'" \
	        --output $@.mktmp
	mv $@.mktmp.map $@.map
	mv $@.mktmp $@

www/css/%.min.css: package.json %/*.css
	mkdir -p www/css
	# i.e. all but package.json
	cat $(filter-out $<,$^) > $@.mktmp
	mv $@.mktmp $@

www/%.html: package.json %/*.html
	cat $(basename $(basename $(notdir $@)))/index.html > $@.mktmp
	mv $@.mktmp $@

www/tw.appcache: www/*.html www/tw.js www/polyfill.js www/mathjax-config.js www/*.css www/*.jpg
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

.PHONY: compile test lint clean watch
