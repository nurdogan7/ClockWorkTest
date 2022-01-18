'use strict';

var path = require('path')
var spawn = require('child_process').spawn
var through = require('through2')

function getSubArgsFor(base, limits) {
  var argv = process.argv.slice(1);

  limits = limits || [];
  var realSubArgs = [];
  argv.forEach((arg, index) => {
    if(arg === base && argv[index + 1] === '--') {
      
      argv.slice(index + 2).some((subArg, index) => {
          if(limits.indexOf(subArg) >= 0) {
            return true;
          }
          realSubArgs.push(subArg);
        })
      }
    });

    if(base !== 'all') { //add args for 'all'
      realSubArgs = realSubArgs.concat(getSubArgsFor('all', limits));
    }

    return realSubArgs;
  }

  //parse arguments
  var argv = require('minimist')(process.argv.slice(2));
  
argv._.forEach(arg => {
  const tokens = arg.split('=')
  argv[tokens[0]] = tokens[1] || true; 
});

argv.all = argv.all || Object.keys(argv).length <= 1;
// console.log(argv);

var npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
var nodemon = process.platform === 'win32' ? 'nodemon.cmd' : 'nodemon';

var pkgDir = '';
var stdin = null;

module.exports = function watchPackage(_pkgDir, exit) {


  pkgDir = _pkgDir;
  var pkg = require(path.join(pkgDir, 'package.json'))
  var processes = {}

  if (typeof pkg.watch !== 'object') {
    die('No "watch" config in package.json')
  }

  // send 'rs' commands to the right proc
  stdin = through(function (line, _, callback) {
    line = line.toString()
    var match = line.match(/^rs\s+(\w+)/)
    if (!match) {
      console.log('Unrecognized input:', line)
      return callback()
    }
    var proc = processes[match[1]]
    if (!proc) {
      console.log('Couldn\'t find process:', match[1])
      return callback()
    }
    proc.stdin.write('rs\n')
    callback()
  })

  stdin.stderr = through()
  stdin.stdout = through()

  var tasks = Object.keys(pkg.watch);
  tasks.forEach(function (script) {

    if(argv.all || argv[script]) {
      if (!pkg.scripts[script]) {
        die('No such script "' + script + '"', 2)
      }

      var subArgs = getSubArgsFor(script,tasks);

      startScript(script, pkg, processes, subArgs.length ? subArgs.join(' ') : argv[script] || argv.all);
    } else {
      console.log('skipping: ', script );
    }
  })
  

  return stdin

  function die(message, code) {
    process.stderr.write(message)

    if (stdin) {
      stdin.end()
      stdin.stderr.end()
      stdin.stdout.end()
    }
    exit(code || 1)
  }
}

function prefixer(prefix) {
  return through(function (line, _, callback) {
    line = line.toString()
    if (!line.match('to restart at any time')) {
      this.push(prefix + ' ' + line)
    }
    callback()
  })
}

function startScript(script, pkg, processes, args) {
  if(typeof args === 'string') {
    console.log('args for ', script, ':' , args);
    args = args.split(' ');
    args.unshift('--')
  } else {
    args = [];
  }
  var exec = [npm, 'run', '-s', script].concat(args).join(' ')
    var patterns = null
    var extensions = null
    var ignores = null
    var quiet = null
    var inherit = null
    var legacyWatch = null
    var delay = null

    if (typeof pkg.watch[script] === 'object' && !Array.isArray(pkg.watch[script])) {
      patterns = pkg.watch[script].patterns
      extensions = pkg.watch[script].extensions
      ignores = pkg.watch[script].ignore
      quiet = pkg.watch[script].quiet
      inherit = pkg.watch[script].inherit
      legacyWatch = pkg.watch[script].legacyWatch
      delay = pkg.watch[script].delay
    } else {
      patterns = pkg.watch[script]
    }

    patterns = [].concat(patterns).map(function (pattern) {
      return ['--watch', pattern]
    }).reduce(function (a, b) {
      return a.concat(b)
    })

    if (ignores) {
      ignores = [].concat(ignores).map(function (ignore) {
        return ['--ignore', ignore]
      }).reduce(function (a, b) {
        return a.concat(b)
      })
    }

    var args = extensions ? ['--ext', extensions] : []
    args = args.concat(patterns)
    if (ignores) { args = args.concat(ignores) }
    if (legacyWatch) { args = args.concat(['--legacy-watch']) }
    if (delay) { args = args.concat(['--delay', delay + 'ms']) }
    args = args.concat(['--exec', exec])
    var proc = processes[script] = spawn(nodemon, args, {
      env: process.env,
      cwd: pkgDir,
      stdio: inherit === true ? ['pipe', 'inherit', 'pipe'] : 'pipe'
    })
    if (inherit === true) return;
    if (quiet === true || quiet === 'true') {
      proc.stdout.pipe(stdin.stdout)
      proc.stderr.pipe(stdin.stderr)
    } else {
      proc.stdout.pipe(prefixer('[' + script + ']')).pipe(stdin.stdout)
      proc.stderr.pipe(prefixer('[' + script + ']')).pipe(stdin.stderr)
    }
}
