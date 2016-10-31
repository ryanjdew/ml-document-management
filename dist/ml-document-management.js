(function () {
  'use strict';

  angular.module('ml.document-management', 
    ['ml.common', 'ml.uploader', 'ui.bootstrap', 
      'ml.document-management.tpls','ngSanitize'
    ]);

}());
(function () {
    'use strict';
    var angular = window.angular;
    var app = angular.module('ml.document-management');
    /**
    * See http://stackoverflow.com/questions/14430655/recursion-in-angular-directives
    */
    app
      .factory('RecursionHelper', ['$compile', function($compile){
        return {
          /**
           * Manually compiles the element, fixing the recursion loop.
           * @param element
           * @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
           * @returns An object containing the linking functions.
           */
          compile: function(element, link){
            // Normalize the link parameter
            if(angular.isFunction(link)){
              link = { post: link };
            }

            // Break the recursion loop by removing the contents
            var contents = element.contents().remove();
            var compiledContents;
            return {
              pre: (link && link.pre) ? link.pre : null,
              /**
               * Compiles and re-adds the contents
               */
              post: function(scope, element){
                // Compile the contents
                if(!compiledContents){
                  compiledContents = $compile(contents);
                }
                // Re-add the compiled contents to the element
                compiledContents(scope, function(clone){
                  element.append(clone);
                });

                // Call the post-linking function, if any
                if(link && link.post){
                  link.post.apply(null, arguments);
                }
              }
            };
          }
        };
      }]);

    app
      .service('directoryExplorerService', DirectoryExplorerService)
      .directive('mlDirectoryExplorer', DirectoryExplorerDirective);

    DirectoryExplorerService.$inject = [ '$rootScope', '$http'];
    function DirectoryExplorerService($rootScope, $http) {
      var service = {};

      service.getDirectoryContents = function(dirName) {
        return $http.get('/v1/resources/directory-list', {
          'params': {
            'rs:directory':  dirName
          }
        })
        .then(function(resp) {
          return resp.data;
        });
      };

      service.getFileDetails = function(fileUri) {
        return $http.get('/v1/resources/directory-list', {
          'params': {
            'rs:file':  fileUri
          }
        })
        .then(function(resp) {
          return resp.data;
        });
      };

      service.createDirectory = function(dirPath) {
        return $http.post('/v1/resources/directory-list', null, {
          params: {
            'rs:directory-path':  dirPath
          }
        });
      };

      return service;
    }

    DirectoryExplorerDirective.$injector = [
      'directoryExplorerService',
      'dlsService',
      'mlUploadService',
      'RecursionHelper',
      'userService',
      '$location',
      '$q',
      '$timeout'
    ];
    function DirectoryExplorerDirective(
      directoryExplorerService,
      dlsService,
      mlUploadService,
      RecursionHelper,
      userService,
      $location,
      $q,
      $timeout
    ) {
      function reloadFileDetails(docMeta) {
        directoryExplorerService.getFileDetails(docMeta.document).then(
          function(data) {
            angular.extend(docMeta, data);
          }
        );
      }

      function resetFormElement(e) {
        e.wrap('<form>').closest('form').get(0).reset();
        e.unwrap();
      }

      var link = function(scope, ele, attr, transclude) {
          scope.user = userService.currentUser() || {};
          scope.model = {};
          scope.files = [];

          scope.uploadOptions = {
            'uriPrefix': (scope.subUri || '/'),
            'extract': 'properties',
            'transform': 'dls-management'
          };

          scope.submitDirectory = function() {
            var dirName = scope.model.newDirectoryName;
            var fullDirUri = (scope.subUri || '/') +
              dirName + '/';
            directoryExplorerService.createDirectory(
              fullDirUri
            ).then(function() {
              scope.$createDirectory = false;
              scope.directories.push({
                'uri': fullDirUri,
                'name': dirName
              });
              scope.directories.sort(function(a, b) {
                var nameA = a.name.toUpperCase(); // ignore upper and lowercase
                var nameB = b.name.toUpperCase(); // ignore upper and lowercase
                if (nameA < nameB) {
                  return -1;
                }
                if (nameA > nameB) {
                  return 1;
                }
                // names must be equal
                return 0;
              });
            });
          };

          scope.createDirectory = function() {
            scope.$createDirectory = true;
          };

          scope.closeDirectory = function(directory) {
            directory.$open = false;
          };

          scope.openDirectory = function(directory) {
            directory.$open = true;
          };

          ele = angular.element(ele);

          var fileInp = ele.find('input[type="file"]:first');

          scope.uploadFile = function(evt) {
            fileInp.click();
            evt.stopPropagation();
          };

          scope.$watch(function() {
            return userService.currentUser();
          },
          function(newVal) {
            if (newVal && newVal.name) {
              scope.user = userService.currentUser();
            }
          }, true);

          directoryExplorerService
            .getDirectoryContents(
              scope.subUri
            )
            .then(function (data) {
              scope.directories = data.directories;
              var directoriesIsEven = scope.directories % 2 === 0;
              scope.evenFileStart = (directoriesIsEven && scope.isEven) || !(directoriesIsEven || scope.isEven);
              scope.dirFiles = data.files;
            });

          var dropzone = ele;

          if (ele.parent('.parent-directory').length) {
            dropzone = ele.parent('.parent-directory');
          }

          // clicking the dropzone is like clicking the file input
          ele
            .on('drop',
              function(e) {
                return mlUploadService.dropFiles(e, dropzone, scope);
              })
            .on('dragenter dragleave dragover',
              function(e) {
                return mlUploadService.dzHighlight(e, dropzone);
              });
          fileInp
            .on('change',
              function(e) {
                mlUploadService.dropFiles(e, ele, scope);
              });
          scope.$watch(function() {
            return scope.files[0] ? scope.files[0].done : false;
          }, function(newVal) {
            if (newVal) {
              var fileName = scope.files[0].name.replace(/\s+/g, '_');
              scope.files.length = 0;
              var matchingFile = null;
              angular.forEach(scope.dirFiles, function(file) {
                if (!matchingFile && file.name === fileName) {
                  matchingFile = file;
                }
              });
              if (!matchingFile) {
                matchingFile = { 
                  document: scope.subUri + fileName,  
                  fileName: fileName
                };
                scope.dirFiles.push(matchingFile);
                scope.dirFiles.sort(function(a, b) {
                  var nameA = a.fileName.toUpperCase(); // ignore upper and lowercase
                  var nameB = b.fileName.toUpperCase(); // ignore upper and lowercase
                  if (nameA < nameB) {
                    return -1;
                  }
                  if (nameA > nameB) {
                    return 1;
                  }
                  // names must be equal
                  return 0;
                });
              }
              $timeout(
                function() {
                  reloadFileDetails(matchingFile);
                },
                100
              );
              resetFormElement(fileInp);
            }
          });
          scope.model.archiveDocument = function(doc) {
            dlsService.archiveDocument(doc.document).then(function() {
              reloadFileDetails(doc);
            });
          };

          scope.model.checkoutDocument = function(doc) {
            dlsService.checkoutDocument(doc.document).then(function() {
              reloadFileDetails(doc);
            });
          };

          scope.model.checkinDocument = function(doc) {
            dlsService.checkinDocument(doc.document).then(function() {
              reloadFileDetails(doc);
            });
          };

          scope.model.documentVersionsModal = dlsService.openDocumentVersionsModal;

          scope.model.editDocumentModal = dlsService.editDocumentModal;
        };
      return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
          subUri: '=',
          isEven: '=?'
        },
        compile: function(element) {
          // Use the compile function from the RecursionHelper,
          // And return the linking function(s) which it returns
          return RecursionHelper.compile(element, link);
        },
        templateUrl: '/ml-document-management/templates/directory-explorer.html'
      };
    }
})();
(function() {
  'use strict';

  angular.module('ml.document-management')
    .factory('dlsService', DLSService)
    .controller('DLSModalController', DLSModalController)
    .filter('verionedFileName', function() {
      return function(input, version) {
        if (input && version) {
          return input.replace(/^(.*)\.([^\.]+)$/, '$1.v' + version + '.$2');
        }
        return input;
      };
    });

  DLSService.$inject = ['$http', '$uibModal', '$q'];
  function DLSService($http, $modal, $q) {

    var service = {
      openDLSModal: function(config) {
        return $modal.open({
          animation: true,
          templateUrl: '/ml-document-management/templates/dls.modal.html',
          controller: 'DLSModalController',
          size: 'lg',
          resolve: {
            config: function () {
              return config;
            }
          }
        }).result;
      },
      documentVersions: function(uri) {
        return $http.get('/v1/resources/dls-management', {
          params: {
            'rs:command': 'list-versions',
            'rs:uri': uri
          }
        }).then(function(resp) {
          return resp.data.versions;
        });
      },
      documentDiff: function(uri, previousUri) {
        return $http.get('/v1/resources/dls-management', {
          params: {
            'rs:command': 'versions-diff',
            'rs:uri': uri,
            'rs:previousUri': previousUri
          }
        }).then(function(resp) {
          return resp.data.diffs;
        });
      },
      openDocumentVersionsModal: function(fileName, uri) {
        return service.documentVersions(uri).then(function(versions) {
          return service.openDLSModal({
            info: {
              title: fileName + ': Versions'
            },
            type: 'versions-list',
            versions: versions,
            fileName: fileName
          });
        });
      },
      editDocumentMetaModal: function(doc) {
        var editingDoc = doc || {};
        if (!doc.metadata) {
          doc.metadata = [];
        }
        if (doc.metadata && !angular.isArray(doc.metadata)) {
          doc.metadata = [doc.metadata];
        }
        var roles = [];
        return service.openDLSModal({
          info: {
            title: (doc.fileName || 'New File') + ': Edit'
          },
          type: 'edit-doc',
          item: editingDoc,
          model: {
            roles: roles
          }
        });
      }
    };

    function dlsCommand(command, uri, annotation, body) {
      return $http.post('/v1/resources/dls-management', body, {
        params: {
          'rs:uri': uri,
          'rs:command': command,
          'rs:annotation': annotation
        }
      });
    }

    service.setPermissions = function(uri, role) {
      return dlsCommand('set-permissions', uri, null, { role: role });
    };

    service.archiveDocument = function(uri) {
      return $http.delete('/v1/resources/dls-management', {
        params: {
          'rs:uri': uri
        }
      });
    };

    service.checkoutDocument = function(uri) {
      return dlsCommand('checkout', uri);
    };

    service.checkinDocument = function(uri) {
      return dlsCommand('checkin', uri);
    };

    service.patchMetadata = function(newDocMeta) {
      var patchXml = '<rapi:patch xmlns:rapi="http://marklogic.com/rest-api" ' +
        'xmlns:prop="http://marklogic.com/xdmp/property" ' +
        'xmlns:document-management="http://marklogic.com/ml-document-management/document-meta">' +
        '<rapi:replace-insert context="/rapi:metadata/prop:properties" ' +
        'position="last-child" select="document-management:metadata">' +
        '<document-management:metadata>' +
        ( newDocMeta.title ?
          ('<document-management:title>' +
            newDocMeta.title +
          '</document-management:title>') : '') +
        ( newDocMeta.description ?
          ('<document-management:description>' +
            newDocMeta.description +
          '</document-management:description>'): '');
      angular.forEach(newDocMeta.metadata, function(val, i) {
        if (val) {
          patchXml += '<document-management:data>' +
            '<document-management:label>' + val.label + '</document-management:label>' +
            '<document-management:value>' + val.value + '</document-management:value>' +
            '</document-management:data>';
        }
      });
      patchXml += '</document-management:metadata></rapi:replace-insert></rapi:patch>';
      return $http.patch('/v1/documents',
        patchXml,
        {
          headers: {
            'Content-Type': 'application/xml'
          },
          params: {
            uri: newDocMeta.document,
            category: 'properties'
          }
        });
    };

    service.editDocumentModal = function(doc) {
      var docUri = doc.document;
      service.editDocumentMetaModal(doc).then(function(newDocMeta) {
        if (newDocMeta && (newDocMeta.title || newDocMeta.description)) {
          service.patchMetadata(doc).then(function() {
              doc.title = newDocMeta.title;
              doc.description = newDocMeta.description;
            });
        }
      });
    };

    return service;
  }

  DLSModalController.$inject = ['$sce', '$scope', '$uibModalInstance', 'config', 'dlsService'];
  function DLSModalController($sce, $scope, $modalInstance, config, dlsService) {
    angular.extend($scope, config);

    $scope.getVersionsDiff = function(uri, previousUri) {
      dlsService.documentDiff(uri, previousUri)
        .then(function(diffs) {
          $scope.diffs = diffs;
        });
    };

    $scope.clearVersionsDiff = function() {
      $scope.diffs = null;
    };

    $scope.sanitize = $sce.trustAsHtml;

    $scope.save = function () {
      $modalInstance.close($scope.item);
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
}());
