(function () {
  'use strict';

  angular.module('ml.document-management', 
    ['ml.common', 'ml.uploader', 'ui.bootstrap']);

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
      .directive('directoryExplorer', DirectoryExplorerDirective);

    DirectoryExplorerService.$inject = [ '$rootScope', '$http'];
    function DirectoryExplorerService($rootScope, $http) {
      var service = {};

      service.getDirectoryContents = function(dirName, caseUri) {
        return $http.get('/v1/resources/directory-list', {
          'params': {
            'rs:directory':  dirName,
            'rs:case-uri': caseUri
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
      '$state',
      '$stateParams'
    ];
    function DirectoryExplorerDirective(
      directoryExplorerService,
      dlsService,
      mlUploadService,
      RecursionHelper,
      userService,
      $location,
      $q,
      $state,
      $stateParams
    ) {
      function reloadPage() {
        $state.transitionTo(
          $state.current,
          angular.extend({'#': $location.hash()}, $stateParams),
          {
            reload: true, inherit: false, notify: true
          }
        );
      }
      var link = function(scope, ele, attr, transclude) {
          scope.user = userService.currentUser() || {};
          scope.model = {};
          scope.files = [];
          function buildMLCP () {
            scope.mlcp = {
              output_collections: 'case-attachments',
              output_permissions: 'cp-analyst,read,cp-analyst,update',
              transform_module: '/ext/mlcp/case-attachment-transform.xqy',
              transform_namespace: 'http://marklogic.com/mlcp-case-attachment',
              transform_param:
                'case-uri=' + scope.caseUri +
                ';annotation=Submitted by ' + scope.user.name +
                ';sub-uri=' + (scope.subUri || '/'),
              thread_count: '16'
            };
          }

          scope.submitDirectory = function() {
            directoryExplorerService.createDirectory(
              scope.caseUri.replace(/\.xml$/, scope.subUri || '/') +
              scope.model.newDirectoryName + '/'
            ).then(function() {
              reloadPage();
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

          buildMLCP();

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
              buildMLCP();
            }
          }, true);

          directoryExplorerService
            .getDirectoryContents(
              scope.caseUri.replace(/\.xml$/, scope.subUri || '/'),
              scope.caseUri
            )
            .then(function (data) {
              scope.directories = data.directories;
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
              reloadPage();
            }
          });
          scope.model.archiveDocument = function(uri) {
            dlsService.archiveDocument(uri).then(function() {
              reloadPage();
            });
          };

          scope.model.checkoutDocument = function(uri) {
            dlsService.checkoutDocument(uri).then(function() {
              reloadPage();
            });
          };

          scope.model.checkinDocument = function(uri) {
            dlsService.checkinDocument(uri).then(function() {
              reloadPage();
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
          caseUri: '=',
          subUri: '=',
          docsMeta: '='
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

  DLSService.$inject = ['$http', '$modal', '$q'];
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
        doc.role = doc.role || 'cp-analyst';
        if (!doc.metadata) {
          doc.metadata = [];
        }
        if (doc.metadata && !angular.isArray(doc.metadata)) {
          doc.metadata = [doc.metadata];
        }
        var roles = [];
        var currentRoleIndex = roles.map(function(v, i) {
          if (v.value === doc.currentUserRole) {
            return i;
          }
        }).filter(isFinite)[0];
        roles.splice(currentRoleIndex + 1);
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

    service.patchMetadata = function(newDocMeta, caseUri, index) {
      var patchXml = '<rapi:patch xmlns:rapi="http://marklogic.com/rest-api">' +
        ( newDocMeta.title ?
          ('<rapi:replace select="/case/associated-documents['+ index +']/title">' +
            newDocMeta.title +
          '</rapi:replace>') : '') +
        ( newDocMeta.description ?
          ('<rapi:replace select="/case/associated-documents['+ index +']/description">' +
            newDocMeta.description +
          '</rapi:replace>'): '');
      if (newDocMeta.metadata) {
        patchXml += '<rapi:delete select="/case/associated-documents['+ index +']/metadata"  />';
        if (!angular.isArray(newDocMeta.metadata)) {
          newDocMeta.metadata = [newDocMeta.metadata];
        }
        angular.forEach(newDocMeta.metadata, function(val, i) {
          if (val) {
            patchXml += '<rapi:insert context="/case/associated-documents['+ index +']" position="last-child">' +
              '<metadata><label>' +  val.label + '</label><value>' + val.value + '</value></metadata>' +
              '</rapi:insert>';
          }
        });
      }
      patchXml += '</rapi:patch>';
      return $http.patch('/v1/documents',
        patchXml,
        {
          headers: {
            'Content-Type': 'application/xml'
          },
          params: {
            uri: caseUri
          }
        });
    };

    service.editDocumentModal = function(caseUri, doc, docs) {
      if (angular.isArray(docs)) {
        var docUri = doc.document;
        var index = doc.metaIndex;
        if (!doc.metaIndex) {
          angular.forEach(docs, function(val, i) {
            if (docUri === val.document) {
              index = i + 1;
            }
          });
        }
        if (index >= 1) {
          var oldDocRole = doc.role;
          service.editDocumentMetaModal(doc).then(function(newDocMeta) {
            if (newDocMeta && (newDocMeta.title || newDocMeta.description)) {
              service.patchMetadata(newDocMeta, caseUri, index).then(function() {
                  doc.title = newDocMeta.title;
                  doc.description = newDocMeta.description;
                  if (newDocMeta.role && newDocMeta.role !== oldDocRole) {
                    service.setPermissions(doc.document, newDocMeta.role);
                  }
                });
              }
            });
        }
      }
    };

    return service;
  }

  DLSModalController.$inject = ['$scope', '$modalInstance', 'config'];
  function DLSModalController($scope, $modalInstance, config) {
    angular.extend($scope, config);

    $scope.save = function () {
      $modalInstance.close($scope.item);
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
}());
