xquery version "1.0-ml";

module namespace resource = "http://marklogic.com/rest-api/resource/dls-management";

import module namespace diff = "http://marklogic.com/demo/xml-diff"
  at "/ext/mlpm_modules/marklogic-xml-diff/diff.xqy";
import module namespace dls = "http://marklogic.com/xdmp/dls"
  at "/MarkLogic/dls.xqy";
import module namespace xq3 = "http://maxdewpoint.blogspot.com/xq3-ml-extensions"
  at "/ext/mlpm_modules/xq3-ml-extensions/xq3.xqy";

declare namespace document-meta = "http://marklogic.com/ml-document-management/document-meta";
declare namespace filter = "http://marklogic.com/filter";
declare namespace prop = "http://marklogic.com/xdmp/property";
declare namespace rapi = "http://marklogic.com/rest-api";


declare function get(
  $context as map:map,
  $params as map:map
) as document-node()?
{
  map:put($context, "output-status", (200, "OK")),
  let $command := map:get($params, "command")
  let $uri := map:get($params, "uri")
  return
    if ($command = "list-versions") then (
      document {
        object-node {
          "versions": array-node {
            let $versions :=
              for $v in dls:document-history($uri)/dls:version
              let $vid := xs:unsignedLong($v/dls:version-id)
              order by $vid descending
              return $v
            for $version at $pos in $versions
            let $version-id := xs:unsignedLong($version/dls:version-id)
            let $next-pos := $pos + 1
            let $previous-version := $versions[$next-pos]
            return
              object-node {
                "versionId": $version-id,
                "versionUri": dls:document-version-uri($uri, $version-id),
                "annotation": fn:string($version/dls:annotation),
                "previousVersion": (
                    if (fn:exists($previous-version)) then
                      dls:document-version-uri($uri, $previous-version/dls:version-id)
                    else
                      null-node {}
                )
              }
          }
        }
      }
    ) else if ($command = "versions-diff") then (
      document {
        object-node {
          "diffs": array-node {
            let $version1 :=
              remove-namespace(xdmp:document-filter(fn:doc(map:get($params, "previousUri"))))
            let $version2 :=
              remove-namespace(xdmp:document-filter(fn:doc($uri)))
            where fn:exists($version1) and fn:exists($version2)
            return
              let $diff := diff:xml-diff($version1, $version2)
              let $outtermost-diffs := xq3:outermost($diff//*[diff:addition|diff:removal])
              let $part-count := fn:count($outtermost-diffs)
              for $part-diffs at $pos in $outtermost-diffs
              return (
                xdmp:quote(transform-to-html($part-diffs)),
                if ($pos ne $part-count) then
                  "<p><em>...</em></p>"
                else ()
              )
          }
        }
      }
    ) else ()
};

declare %rapi:transaction-mode("update") function put(
  $context as map:map,
  $params as map:map,
  $input as document-node()*
) as document-node()?
{
  let $command := map:get($params, "command")
  let $uri := map:get($params, "uri")
  let $annotation := map:get($params, "annotation")
  return
    if ($command = "checkin") then (
      dls:document-checkin($uri, fn:false())
    ) else if ($command = "checkout") then (
      dls:document-checkout($uri, fn:false(), $annotation)
    ) else if ($command = "set-permissions") then (
      let $role := $input/object-node()/role
      let $permissions :=
        (
          xdmp:permission($role, "read"),
          xdmp:permission($role, "update")
        )
      return (
        dls:document-set-permissions($uri, $permissions)
      )
    ) else (),
  map:put($context, "output-status", (200, "OK"))
};

declare %rapi:transaction-mode("update") function delete(
  $context as map:map,
  $params as map:map
) as document-node()?
{
  let $uri := map:get($params, "uri")
  return (
      dls:document-delete($uri, fn:true(), fn:true())
    ),
  map:put($context, "output-status", (200, "OK"))
};

declare %rapi:transaction-mode("update") function post(
  $context as map:map,
  $params as map:map,
  $input as document-node()*
) as document-node()*
{
  put($context, $params, $input)
};

declare function transform-to-html($node) {
  typeswitch($node)
  case element(diff:removal) return
    element strike {
      attribute class {"text-danger"},
      $node/node()
    }
  case element(diff:addition) return
    element u {
      attribute class {"text-success"},
      $node/node()
    }
  case element() return
    element {fn:local-name($node)} {
      $node/@*,
      if ($node/@diff:removal eq "true") then
        element stike {
          attribute class {"text-danger"},
          fn:map(transform-to-html#1, $node/node())
        }
      else if ($node/@diff:addition eq "true") then
        element u {
          attribute class {"text-success"},
          fn:map(transform-to-html#1, $node/node())
        }
      else
        fn:map(transform-to-html#1, $node/node())
    }
  default return
    $node
};

declare function remove-namespace($node) {
  typeswitch($node)
  case document-node() return
    document {
      fn:map(remove-namespace#1, $node/node())
    }
  case element() return
    element {fn:local-name($node)} {
      $node/@*,
      fn:map(remove-namespace#1, $node/node())
    }
  default return
    $node
};
