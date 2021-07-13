# gulp-resolve-dependencies
> Resolve dependency directives in assets, e.g. ```@depend``` ([Juicer](https://github.com/cjohansen/juicer)) or ```//= require``` ([Sprockets](https://github.com/sstephenson/sprockets))). Inspired by [grunt-concat-in-order](https://github.com/miensol/grunt-concat-in-order). Useful in combination with [gulp-concat](https://github.com/wearefractal/gulp-concat).

## Usage

First, install `gulp-resolve-dependencies` as a development dependency:

```shell
npm install --save-dev gulp-resolve-dependencies
```

Then, add it to your `gulpfile.js` (probably together with [gulp-concat](https://github.com/wearefractal/gulp-concat)):

```javascript
var resolveDependencies = require('gulp-resolve-dependencies');
var concat = require('gulp-concat');

gulp.task('js', function(){
  gulp.src(['app/assets/js/main.js'])
    .pipe(resolveDependencies({
      pattern: /\* @requires [\s-]*(.*\.js)/g
    }))
        .on('error', function(err) {
            console.log(err.message);
        })
    .pipe(concat())
    .pipe(gulp.dest('dest/assets/js/'));
});
```

And use the directives in your JS files (dependencies can be nested, they are handled recursively):

```javascript
/**
 * @requires libs/jquery/jquery.js
 * @requires ../modules/slideshow/slideshow.js
 */

(function(window, document, $, undefined) {
    'use strict';

    $(document).on('ready', function() {
        $('.slideshow').slideshow();
    });

})(window, document, jQuery);
```

**Warning**: This might not be very efficient (especially in case of nested dependencies). Some kind of caching mechanism could come in handy.

Circular dependencies are either silently ignored or emit an error. See ```options.ignoreCircularDependencies``` below.

`gulp.src` will not necessarily return files in a [deterministic way](https://github.com/gulpjs/gulp/issues/687). If this turns out to be an issue, using a plugin like [`gulp-sort`](https://www.npmjs.com/package/gulp-sort) or [`gulp-order`](https://www.npmjs.com/package/gulp-order) right after `gulp.src` might be an option for you. Thanks to @fabiospampinato for [pointing this out](https://github.com/backflip/gulp-resolve-dependencies/issues/10).

## API

### resolveDependencies(options)

#### options.pattern
Type: `RegExp`

The matching pattern (defaults to ```/\* @requires [\s-]*(.*?\.js)/g```).

#### options.resolvePath
Type: `Function`

Resolver for matched paths. Default:
```javascript
function(match, targetFile) {
    return path.join(path.dirname(targetFile.path), match);
}
```

Parameters:
* `match` {String} Matched file path (in the example above this would be `libs/jquery/jquery.js` and `../modules/slideshow/slideshow.js`, respectively)
* `targetFile` {Vinyl file object} Currently parsed file (where the matches were found)

The `path` package is available in this context.

Returning a falsy value will ignore the resolved path:
```javascript
function(match, targetFile) {
    // Ignore `/lib.js`
    if (match.match(/\/lib\.js$/)) {
        return null;
    }

    return path.join(path.dirname(targetFile.path), match);
}
```

#### options.log
Type: `Boolean`

Whether to log the resolved dependencies (defaults to ```false```).

#### options.ignoreCircularDependencies
Type: `Boolean`

Whether to just continue instead of emitting an error if circular dependencies are detected (defaults to ```false```).

#### options.include
Type: `Array`

Only dependencies matching this array of absolute paths will be included (defaults to ```[]```).

#### options.exclude
Type: `Array`

Dependencies matching this array of absolute paths will be excluded (defaults to ```[]```).


## Contributors

* @huang64: [Circular dependencies](https://github.com/backflip/gulp-resolve-dependencies/pull/7)
* @doronin: [Path resolver option](https://github.com/backflip/gulp-resolve-dependencies/pull/8)
* @goodforenergy: [Relative file paths](https://github.com/backflip/gulp-resolve-dependencies/pull/16)
* @adrianosanti: [Outdated dependencies](https://github.com/backflip/gulp-resolve-dependencies/pull/18)
