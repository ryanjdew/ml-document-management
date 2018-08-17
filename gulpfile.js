/*jshint node: true */

'use strict';

var gulp = require('gulp'),
    concat = require('gulp-concat'),
    html2Js = require('gulp-ng-html2js'),
    jshint = require('gulp-jshint'),
    karma = require('karma').server,
    less = require('gulp-less'),
    minifyHtml = require('gulp-minify-html'),
    path = require('path'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    rm = require('gulp-rm'),
    ghpages = require('gulp-gh-pages'),
    cp = require('child_process');

gulp.task('jshint', function() {
  return gulp.src([
      './gulpfile.js',
      './src/**/*.js'
    ])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('styles', function() {
  return gulp.src('./src/styles/*.less')
    .pipe(concat('ml-document-management.less'))
    .pipe(gulp.dest('dist'))
    .pipe(rename('ml-document-management.css'))
    .pipe(less())
    .pipe(gulp.dest('dist'));
});

gulp.task('test', function() {
  return karma.start({
    configFile: path.join(__dirname, './karma.conf.js'),
    singleRun: true,
    autoWatch: false
  }, function (exitCode) {
    console.log('Karma has exited with ' + exitCode);
    process.exit(exitCode);
  });
});

gulp.task('autotest', function() {
  return karma.start({
    configFile: path.join(__dirname, './karma.conf.js'),
    autoWatch: true
  }, function (exitCode) {
    console.log('Karma has exited with ' + exitCode);
    process.exit(exitCode);
  });
});

gulp.task('docs', function() {
  return cp.exec('./node_modules/.bin/jsdoc -c jsdoc.conf.json', function(err) {
    if (err) {
      return console.log(err);
    }

    gulp.src([ './docs/generated/css/baseline.css', './docs/custom-styles.css' ])
    .pipe(concat('baseline.css'))
    .pipe(gulp.dest('./docs/generated/css'));
  });
});

gulp.task('clean-docs', function() {
  return gulp.src('./docs/generated/**/*', { read: false })
  .pipe(rm({async: false}));
});

gulp.task('publish-docs', function() {
  return gulp.src([ './docs/generated/**/*.*' ])
  .pipe(ghpages());
});

gulp.task('scripts', gulp.series(/*'test',*/ function(done) {
  return gulp.src([
      './src/ml-document-management.js',
      './src/**/*.js'
    ])
    .pipe(concat('ml-document-management.js'))
    .pipe(gulp.dest('dist'))
    .pipe(rename('ml-document-management.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist'));
}));

gulp.task('templates', gulp.series('test', function() {
  return gulp.src([ './src/**/*.html' ])
    .pipe(minifyHtml({
        empty: true,
        spare: true,
        quotes: true
    }))
    .pipe(html2Js({
      moduleName: 'ml.document-management.tpls',
      prefix: '/ml-document-management/'
    }))
    .pipe(concat('ml-document-management-ng-tpls.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist'));
}));

gulp.task('default', gulp.series('jshint', 'scripts', 'templates', 'styles', function(done){done();}));