all: submission.sha1

submission.sha1: submission.tar.gz
	shasum $< > $@

submission.tar.gz: solution/lambdaman.gcc code/README
	tar -czf $@ solution code
