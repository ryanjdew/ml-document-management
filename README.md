# MarkLogic Document Management

This is a library for managing documents in MarkLogic. Currently it has the capability to create directories and add files. Files added have their xdmp:document-filter results extracted to the properties. Files are also managed with the MarkLogic DLS.

Multiple versions of files are retained and as part of DLS management. The multiple versions can be retrieved and diffs of the extracted data can be displayed.

## Getting Started

    bower install ml-document-management-ng --save

And install the mlpm module:

    npm install -g mlpm
    mlpm install ml-document-management --save

Now you can deploy the mlpm_modules to MarkLogic:
    
    mlpm deploy -H localhost -P 8040 -u admin -p admin

## Directive Provided

- `mlDirectoryExplorer`

## Example Implementation

Add the ml.document-management module as a dependency to your app.module. For
example, in a [slush-generated app](https://github.com/marklogic/slush-marklogic-node), add this to
`ui/app/app.js`:

```javascript
angular.module('app', [
   # ...
  'ml.document-management',
  # ...
]);
```

Simply add this to your HTML markup in order to show the explorer view:

```html
  <ml-directory-explorer sub-uri="/"></ml-directory-explorer>
```

![Directory Explorer](readme-resources/directory-explorer.png)


# Troubleshooting

The role dls-user is required in order to run the DLS functions. 

Also, existing directories must have the directory property set in MarkLogic. For more details, view the [MarkLogic Developer's Guide](https://docs.marklogic.com/guide/app-dev/properties#id_86551).
