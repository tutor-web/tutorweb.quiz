GIT = git
NPM = npm
NODEJS = node

NODE_PATH = node_modules

all: install_dependencies test lint tutorweb/quiz/resources/tw.js

pre_commit: lint tutorweb/quiz/resources/tw.js

test: install_dependencies
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/run-tests.js

lint:
	$(NODEJS) node_modules/jslint/bin/jslint lib/*.js

install_dependencies:: repo_hooks
	NODE_PATH=$(NODE_PATH) $(NPM) install

repo_hooks:
	(cd .git/hooks/ && ln -sf ../../hooks/pre-commit pre-commit)

tutorweb/quiz/resources/tw.appcache: tutorweb/quiz/resources/*.html tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/polyfill.js tutorweb/quiz/resources/dropdown.js tutorweb/quiz/resources/mathjax-config.js
	@echo "CACHE MANIFEST\n" > $@
	@for f in $+; do basename $$f; done >> $@
	@echo "mathjax/MathJax.js" >> $@
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
	@echo "mathjax/jax/output/HTML-CSS/fonts/TeX/fontdata.js" >> $@
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

tests/html/tw-test.js: lib/*.js lib/standalone/*.js tests/html/mock-tutorial.js
	$(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js --debug \
	    lib/*.js lib/standalone/*.js tests/html/mock-tutorial.js \
	    > tests/html/tw-test.js

webserver: tutorweb/quiz/resources/tw.js tests/html/tw-test.js
	git submodule update --init
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/html/server.js

.PHONY: pre_commit test lint install_dependencies repo_hooks watch webserver
