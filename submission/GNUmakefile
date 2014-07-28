all: submission.sha1

submission.sha1: submission.tar.gz
	shasum $< > $@

submission.tar.gz: solution/lambdaman.gcc solution/ghost0.ghc code/README
	tar -czf $@ solution code
