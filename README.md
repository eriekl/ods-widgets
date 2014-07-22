ODS Widgets
===========
**ODS-Widgets** is a library of web components that can be used to build rich and
interactive pages of datavisualization, live from data available on a remote API.

In more concrete terms, it is a set of AngularJS directives that can be directly
plugged on a remote data API (currently OpenDataSoft only); those directives
can interact with each others using shared contexts (for example a "calendar"
directive could refine the data displayed by a "table" directive). It is
designed to work without the need for a local backend, and to be efficient to
build data visualization pages and dashboards by just manipulating HTML markup (AngularJS
directive tags). Since it is regular HTML, it can be integrated in your current
pages, supports CSS styling, and generally works in a way that will feel familiar
if you know HTML. **It does not require knowing AngularJS to be used.**

This library is used in production as a part of the OpenDataSoft platform, a
Software-as-a-Service data portal. It is essentially the current core of our
front-end data visualization features.

#### [> Visit the samples](http://opendatasoft.github.com/ods-widgets/)

### Quick example
Let's show a map of the restaurants near our former office in Paris. The data
can be browsed on http://public.opendatasoft.com/explore/dataset/restaurants_a_proximite_de_pepiniere_27/
```html
<!-- Expose a "dataset context" from the data -->
<ods-dataset-context context="restaurants" public-domain="public.opendatasoft.com" public-dataset="restaurants_a_proximite_de_pepiniere_27">
  <!-- Display a map from the data exposed from this context -->
  <ods-map context="restaurants">
</ods-dataset-context>
```

### Documentation
There is a complete tutorial to help you build your first page around a simple example.
Since it is build on public data, you can reproduce it by yourself and even use it as a basis
for your first project.
#### [> Tutorial to build your first page](http://opendatasoft.github.com/ods-widgets/)

There is a complete reference documentation of all the available directives and all
the parameters they support. It also contains more literature on the technical
details of the library.
#### [> Reference Documentation](http://opendatasoft.github.com/ods-widgets/)


### Available API and data sources
Currently, ODS-Widgets only works with an API from an OpenDataSoft domain, or any API
that exposes the same interface and returns the same JSON result.

This project originates from OpenDataSoft codebase, and as such obviously works
closely with our own interfaces; however, we are looking to make this framework work
with more APIs and services (and thankfully, AngularJS can make it easier), for example by
implementing more AngularJS services as sources, beside our ODSAPI service.
If you have an API that exposes structured data in a way that looks
like our widgets could display it, and you want to try to make it work with it,
you can contact us.

### Compatibility
Known to work on: (may not be exhaustive)
- Internet Explorer 9+
- Safari 6+
- Chrome 12+
- Firefox 4+
- Android Browser from Android 3.0+

### Setup
The following libraries are required as dependencies in your pages for ODS-Widgets to work:
- **jQuery** (1.6+ should work) *note: we're looking to ditch this dependency in the future*
- **AngularJS** 1.2.* and the **angular-sanitize** optional module

To load ODS-Widgets, you can then simply load `ods-widgets.js` and `ods-widgets.css`.

Some specific widgets can rely on specific "heavy" libraries (such as Highcharts, Leaflet...);
in that case, they are lazily-loaded from a CDN when the widget initializes itself.

ODS-Widgets require an AngularJS app to run, and the 'ods-widgets' module added as a dependency;
here is a simple way to achieve that:
```html
<body>
  <div ng-app="sample">
    <!-- Within this div, we are in an Angular app where ODS-Widgets tags will run -->
    {{ "hello" + "from" + "angular!"}}
  </div>
  <script type="text/javascript">
    var app = angular.module('sample', ['ods-widgets']);
  </script>
</body>
```

### License
This software library is licensed under the MIT license.

### Contact
If you have questions, you can contact us on Twitter (@opendatasoft) or simply open an GitHub issue.
