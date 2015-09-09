var gulp = require('gulp'),
	fs = require('fs'),
	path = require('path'),
	es = require('event-stream'),
	assert = require('assert'),
	concat = require('gulp-concat'),
	tap = require('gulp-tap'),
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
		function resolvePath(match, targetFile) {
			match = match.replace(/com\.example\./, '').replace(/\./g, '/');
			match += '.js';

			return path.join(path.dirname(targetFile.path), match);
		}

		gulp.src(__dirname + '/fixtures/resolvepath.js')
			.pipe(resolveDependencies({
				pattern: /\* @requires [\s-]*(.*)/g,
				resolvePath: resolvePath
			}))
			.pipe(concat('resolvepath.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assert.equal(
					fs.readFileSync(__dirname + '/results/resolvepath.js', 'utf8'),
					fs.readFileSync(__dirname + '/expected/resolvepath.js', 'utf8')
				);

				fs.unlinkSync(__dirname + '/results/resolvepath.js');
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

	it('should report the initial file stats', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies())
			.pipe(tap(function(file) {
				assert.deepEqual(
					fs.statSync(file.path).mtime,
					file.stat.mtime
				);
			}))
			.on('end', function() {
				done();
			});
	});
});
