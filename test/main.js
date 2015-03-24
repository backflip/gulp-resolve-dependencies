var gulp = require('gulp'),
	fs = require('fs'),
	path = require('path'),
	es = require('event-stream'),
	assert = require('assert'),
	concat = require('gulp-concat'),
	resolveDependencies = require('../');

describe('gulp-resolve-dependencies', function() {
	it('should generate concatenated JS file', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies())
			.pipe(concat('main.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assert.equal(
					fs.readFileSync(__dirname + '/results/main.js', 'utf8'),
					fs.readFileSync(__dirname + '/expected/main.js', 'utf8')
				);

				fs.unlinkSync(__dirname + '/results/main.js');
				fs.rmdirSync(__dirname + '/results/');

				done();
			}));
	});

	it('should use resolvePath and generate concatenated JS file', function(done) {
		function toAbsolutePath(match, targetFile) {
			var absolutePath = path.join(__dirname, 'fixtures', match);
			return absolutePath;
		}

		gulp.src(__dirname + '/fixtures/main2.js')
			.pipe(resolveDependencies({
				pattern: /\* @requires [\s-]*(.*)/g,
				resolvePath: toAbsolutePath
			}))
			.pipe(concat('main2.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				var expected = fs.readFileSync(__dirname + '/expected/main2.js', 'utf8');

				assert.equal(
					fs.readFileSync(__dirname + '/results/main2.js', 'utf8'),
					expected
				);

				fs.unlinkSync(__dirname + '/results/main2.js');
				fs.rmdirSync(__dirname + '/results/');

				done();
			}));
	});

	it('should throw error due to circular dependency', function(done) {
		gulp.src(__dirname + '/circular/a.js')
			.pipe(resolveDependencies())
			.on('error', function() {
				done();
			});
	});
});
