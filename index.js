var bolt = require('firebase-bolt');
var through = require('through2');
var readfile = require('fs-readfile-promise');
var path = require('path');
//var fileIO =
// Consts
const PLUGIN_NAME = 'gulp-firebase-bolt';

/*
  Firebase bolt gulp plugin
  Note: Using a modified bolt syntax to include imports
*/

module.exports = function() {
    // creating a stream through which each file will pass
    var cwd ='';
      var stream = through.obj(function(file, enc, cb) {
        var self = this;
        var newfile = file.clone({contents: false});
        var content ='';
        // base relative path
        var cwdPath = file.cwd.split(path.sep);
        var histPath = file.history[0].split(path.sep);
        for(var i=0;i< cwdPath.length ;i++){
          histPath.shift();
        }
        histPath.pop();
        cwd = './';
        if(histPath.length >0){
          cwd =  cwd + histPath.join('/');
        }
        if (file.isBuffer()) {
          content = file.contents.toString()
          parserWrapper(content).then(function(symbols){
            readSuccess(symbols, cb,newfile );
          }).catch(function(ex){
             this.emit('error', new PluginError(PLUGIN_NAME, 'Error converting file'));
             cb();
          });
        } else if (file.isStream()) {
          file.contents.on('data', function(chunk) {
            content = content + chunk;
          });
          file.contents.on('end', function(){
            // make sure the file goes through the next gulp plugin
            parserWrapper(content ).then(function(symbols){
              readSuccess(symbols, cb,newfile );
            }).catch(function(ex){
               this.emit('error', new PluginError(PLUGIN_NAME, 'Error converting file'));
               cb();
            });
          });

        } else {
          cb();
        }
      });
      // returning the file stream
    return stream;

    function readSuccess(symbols, cb,newfile){
      var gen = new bolt.Generator(symbols);
      console.log(symbols);
      var rules = gen.generateRules();
      var output =  JSON.stringify(rules, null, 2);
      //file.contents.end(output);
      newfile.contents = new Buffer(output);
      newfile.path = newfile.path.replace('.bolt','.json');
      cb(null, newfile);// finished
    };
    function parsePath(path) {
       var extname = Path.extname(path);
       return {
         dirname: Path.dirname(path),
         basename: Path.basename(path, extname),
         extname: extname
       };
     }
     var sym;
    function parserWrapper(data) {
      var promises = [];
      sym = bolt.parse(data);
      while (sym.imports.length > 0) {
          var next = sym.imports.pop();
          var p = processRecursive(next);
          promises.push(p);
      } // end while
      var retPromise = new Promise(function(resolve, reject){
        Promise.all(promises).then(function(){
          console.log("sym:");
          console.log(sym);
          resolve(sym);
        }).catch(function(ex){
          console.log(ex);
        });
      });
      return retPromise;
    }; // end function

    function processRecursive(next){

      var promises = [];
      console.log('next:' + JSON.stringify(next));
      var p = new Promise(function(resolve, reject) {
        readfile( cwd +  '/' + next.filename + '.bolt').then(
          function(subData) {
            var subPromises = [];
            var newRules = bolt.parse(subData.toString());
            if (newRules) {
                newRules.imports.map(function (obj) {
                    sym.imports.push(obj);
                    return obj;
                });
            }
            for (var funcKey in newRules.functions) {
                if (newRules.functions.hasOwnProperty(funcKey)) {
                    sym.functions[funcKey] = newRules.functions[funcKey];
                }
            }
            for (var schemaKey in newRules.schema) {
                if (newRules.schema.hasOwnProperty(schemaKey)) {
                    sym.schema[schemaKey] = newRules.schema[schemaKey];
                }
            }
            /*
            {
              filename:
              alias:
              scope: fale = local
            }
            */
            console.log('imports:' + JSON.stringify(newRules.imports));
            for(var impKey in newRules.imports){
                var imp = newRules.imports[impKey];
                var nextFn = next.filename.split('/');
                var currentFn = imp.filename.split('/');
                if(imp.scope){
                  var relPath = '';
                  for(var j = 0; j < cwd.split('/').length-1;j++){
                    relPath = relPath + '../';
                  }
                  imp.filename =relPath+ '/node_modules/' + imp.filename + '/index';
                } else{
                  nextFn.pop();
                  imp.filename  = nextFn.concat(currentFn).join('/');
                }
                // check for global modules
                var inner = processRecursive(imp);
                subPromises.push(inner);
                // push a new import path
            }
            Promise.all(subPromises).then(function(){
              resolve();
            }).carch(function(ex){
              this.emit('error in parsed files');
            });

        }); // end readFile
      }); // end promise
    promises.push(p);

    var retPromise = new Promise(function(resolve, reject){
      Promise.all(promises).then(function(){
        resolve();
      }).catch(function(ex){
        console.log(ex);
      });
    });
    return retPromise;
    }
};
