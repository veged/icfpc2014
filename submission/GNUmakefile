all: submission.sha1

submission.sha1: submission.tar.gz
	shasum $< > $@

submission.tar.gz: solution/lambdaman.gcc solution/ghost0.ghc README
	tar -czf $@ solution code README

solution/lambdaman.gcc: code/lambdaman.js
	cd code/gcc && npm install
	code/gcc/bin/gcc < $< > $@

solution/ghost0.ghc: code/ghost0.src
	code/ghc/bin/ghc < $< > $@
