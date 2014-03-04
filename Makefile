GIT = git
NPM = npm
NODEJS = nodejs

NODE_PATH = node_modules

all: install_dependencies test tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/tw-debug.js

pre_commit: lint tutorweb/quiz/resources/tw.js tutorweb/quiz/resources/tw-debug.js

test:: install_dependencies
	NODE_PATH=$(NODE_PATH) $(NODEJS) tests/run-tests.js

lint::
	$(NODEJS) node_modules/jshint/bin/jshint -v lib/*.js

install_dependencies:: repo_hooks
	NODE_PATH=$(NODE_PATH) $(NPM) install --prefix=$(NODE_PATH)

repo_hooks::
	(cd .git/hooks/ && ln -sf ../../hooks/pre-commit pre-commit)

tutorweb/quiz/resources/tw.js:
	NODE_PATH=$(NODE_PATH) $(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js lib/*.js -o tutorweb/quiz/resources/tw.js

tutorweb/quiz/resources/tw-debug.js:
	NODE_PATH=$(NODE_PATH) $(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js lib/*.js -d -o tutorweb/quiz/resources/tw-debug.js
