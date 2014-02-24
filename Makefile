GIT = git
NPM = npm
NODEJS = nodejs

NODE_PATH = node_modules

all: tutorweb/quiz/resources/tw.js

test:
	NODE_PATH=$(NODE_PATH) $(NODEJS) run-tests.js

install_dependencies:
	NODE_PATH=$(NODE_PATH) $(NODEJS) install --prefix=$(NODE_PATH)

production:
	$(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js lib/*.js -o tutorweb/quiz/resources/tw.js

tutorweb/quiz/resources/tw.js:
	NODE_PATH=$(NODE_PATH) $(NODEJS) $(NODE_PATH)/browserify/bin/cmd.js lib/*.js -d -o tutorweb/quiz/resources/tw.js
