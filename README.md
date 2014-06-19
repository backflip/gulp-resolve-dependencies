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

gulp.task('js', function() {
  gulp.src(['app/assets/js/main.js'])
    .pipe(resolveDependencies({
      pattern: /\* @requires [\s-]*(.*?\.js)/g
    }))
    .pipe(concat())
    .pipe(gulp.dest('dest/assets/js/'))
  ;
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


## API

### resolveDependencies(options)

#### options.pattern
Type: `RegExp`

The matching pattern (optional, defaults to ```/\* @requires [\s-]*(.*?\.js)/g``).

#### options.log
Type: `Boolean`

Whether to log the resolved dependencies (optional, defaults to ```false```).

#### options.fail
Type: `Boolean`

Whether to fail if dependency is not found (optional, defaults to ```true```).

