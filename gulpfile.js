// standard module
var path = require('path')
var fs = require('fs')
var del = require('del')
var exec = require('child_process').exec

// npm module
var gulp = require('gulp')
var runSequence = require('run-sequence')

// npm module for production and deployment
var util = require('gulp-util')
var release = require('gulp-github-release')
var bump = require('gulp-bump')
var git = require('gulp-git')
var tag = require('gulp-tag-version')

// settings
var packageJSON = './package.json'
var pkg = JSON.parse(fs.readFileSync(packageJSON))

gulp.task('build', function () {
  return gulp.src('./src/**')
    .pipe(gulp.dest('build/'))
})

//
// Production Tasks
//
var packageDir = path.join(__dirname, '/package')
var packageSource = 'archive'
var packageZip = 'archive-' + pkg.version + '.zip'
var destFilesDir = path.join(packageDir, packageSource, 'build')
var destSourceDir = path.join(packageDir, packageSource, 'source')

// GitHubにリリースを作成する
gulp.task('release', ['package'], function () {
  var config = require('./config.json')
  return gulp.src(path.join(packageDir, packageZip))
    .pipe(release({
      token: config.token,
      manifest: pkg
    }))
})

// 納品用ディレクトリを削除
gulp.task('package:clean', function (cb) {
  return del(packageDir + '/*', { force: true }, cb)
})

// ビルド済みのファイルを納品用ディレクトリにコピーする
gulp.task('package:copy-files', function () {
  return gulp.src([ 'build/**/*' ], { base: 'build' })
    .pipe(gulp.dest(destFilesDir))
})

// 納品用ビルド済みファイルを作成
gulp.task('package:build', function (cb) {
  del(destFilesDir, { force: true }).then(function (paths) {
    runSequence('build', 'package:copy-files', cb)
  })
})

// 現在のブランチの最新コミットから納品用ソースファイルを作成
gulp.task('package:source', function (cb) {
  var cmd = [
    'rm -rf ' + destSourceDir,
    'mkdir -p ' + destSourceDir,
    'git archive --format=tar HEAD | tar zxfp - -C ' + destSourceDir
  ].join(' && ')
  exec(cmd, function (err, stdout, stderr) {
    if (err) return cb(err)
    if (stderr) console.log(stderr)
    if (stdout) console.log(stdout)
    cb()
  })
})

// 納品用ZIPを作成
gulp.task('package:zip', function (cb) {
  pkg = JSON.parse(fs.readFileSync(path.join(destSourceDir, 'package.json')))
  packageZip = 'archive-' + pkg.version + '.zip'
  var cmd = [
    'cd ' + packageDir,
    'zip -q ' + packageZip + ' -r ' + packageSource
  ].join(' && ')
  exec(cmd, function (err, stdout, stderr) {
    if (err) return cb(err)
    if (stderr) console.log(stderr)
    if (stdout) console.log(stdout)
    cb()
  })
})

// 納品用ファイルを生成する
gulp.task('package', function (cb) {
  runSequence(
    'package:clean',
    'package:build',
    'package:source',
    'package:zip',
    function (err) {
      if (err) return cb(err)
      cb()
      var filename = packageDir.split(__dirname)[1] + '/' + packageZip
      logSuccess('Created ' + filename)
    }
  )
})

function logSuccess (msg) {
  util.log(util.colors.green(msg))
}

/**
 * Bumping version number and tagging the repository with it.
 * Please read http://semver.org/
 *
 * You can use the commands
 *
 *     gulp tag:patch     # makes v0.1.0 → v0.1.1
 *     gulp tag:feature   # makes v0.1.1 → v0.2.0
 *     gulp tag:release   # makes v0.2.1 → v1.0.0
 *
 * To bump the version numbers accordingly after you did a patch,
 * introduced a feature or made a backwards-incompatible release.
 */

function inc (importance) {
  return gulp.src(packageJSON)
    .pipe(bump({type: importance}))
    .pipe(gulp.dest('./'))
    .pipe(git.commit('bumps version'))
    .pipe(tag())
    .pipe(git.push('origin', 'master', {args: '--tags'}))
}

gulp.task('tag:patch', function () { return inc('patch') })
gulp.task('tag:feature', function () { return inc('minor') })
gulp.task('tag:release', function () { return inc('major') })
