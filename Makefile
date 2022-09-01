GIT = git
NPM = npm
NODEJS = node

NODE_PATH = node_modules

all: install_dependencies test lint tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/serviceworker.js

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

tutorweb/quiz/resources/serviceworker.js: lib-sw/*.js tutorweb/quiz/resources/*.html tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/polyfill.js tutorweb/quiz/resources/mathjax-config.js tutorweb/quiz/resources/*.css tutorweb/quiz/resources/*.jpg
	cat lib-sw/*.js > $@
	@echo "" >> $@
	@echo -n "// MD5: " >> $@
	@cat $+ | md5sum | cut -d' ' -f1 >> $@

# NB: We use .js.map.js here, so Python interprets as application/javascript
# and Diazo doesn't XHTMLify. We could add to /etc/mime.types but that's unfriendly
# to other developers
tutorweb/quiz/resources/tw.js: lib/*.js lib/standalone/*.js
	(cd tutorweb/quiz/resources/ && ln -sf ../../../lib .)
	(cd tutorweb/quiz/resources/ && ln -sf ../../../node_modules .)
	$(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js --debug \
	        lib/*.js lib/standalone/*.js \
	        -g uglifyify \
	    | $(NODEJS) $(NODE_PATH)/exorcist/bin/exorcist.js $@.map.js \
	    > $@.mktmp
	mv $@.mktmp $@

webserver: tutorweb/quiz/resources/tw.js
	git submodule update --init
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/html/server.js

.PHONY: pre_commit test coverage lint install_dependencies repo_hooks watch webserver
