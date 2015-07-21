GIT = git
NPM = npm
NODEJS = node

NODE_PATH = node_modules

all: install_dependencies test lint tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/tw.appcache

pre_commit: lint tutorweb/quiz/resources/tw.js

test: install_dependencies
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/run-tests.js

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
	@echo "mathjax/images/MenuArrow-15.png" >> $@
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
	@echo "/" >> $@
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

.PHONY: pre_commit test lint install_dependencies repo_hooks watch webserver
