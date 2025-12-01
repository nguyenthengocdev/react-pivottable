# react-pivottable

`react-pivottable` is a React-based pivot table library with drag'n'drop
functionality. It is a React port of the jQuery-based
[PivotTable.js](https://pivottable.js.org/) by the same author.

`react-pivottable` is part of Plotly's [React Component Suite](https://plot.ly/products/react/) for building data visualization Web apps and products.

<div align="center">
  <a href="https://dash.plotly.com/project-maintenance">
    <img src="https://dash.plotly.com/assets/images/maintained-by-plotly.png" width="400px" alt="Maintained by Plotly">
  </a>
</div>

## What does it do & where is the demo?

`react-pivottable`'s function is to enable data exploration and analysis by
summarizing a data set into table or [Plotly.js](https://plot.ly/javascript/)
chart with a true 2-d drag'n'drop UI, very similar to the one found in older
versions of Microsoft Excel.

A [live demo can be found here](https://react-pivottable.js.org/).

![screencap](examples/basic.gif)

## How can I use it in my project?

### Drag'n'drop UI with Table output only

Installation is via NPM and has a peer dependency on React:

```
npm install --save react-pivottable react react-dom
```

Basic usage is as follows. Note that `PivotTableUI` is a "dumb component" that
maintains essentially no state of its own.

```js
import React from 'react';
import ReactDOM from 'react-dom';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';

// see documentation for supported input formats
const data = [['attribute', 'attribute2'], ['value1', 'value2']];

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = props;
    }

    render() {
        return (
            <PivotTableUI
                data={data}
                onChange={s => this.setState(s)}
                {...this.state}
            />
        );
    }
}

ReactDOM.render(<App />, document.body);
```

### Drag'n'drop UI with Plotly charts as well as Table output

The Plotly `react-plotly.js` component can be passed in via dependency
injection. It has a peer dependency on `plotly.js`.

**Important:** If you build your project using webpack, you'll have to follow
[these instructions](https://github.com/plotly/plotly.js#building-plotlyjs-with-webpack)
in order to successfully bundle `plotly.js`. See below for how to avoid having
to bundle `plotly.js`.

```
npm install --save react-pivottable react-plotly.js plotly.js react react-dom
```

To add the Plotly renderers to your app, you can use the following pattern:

```js
import React from 'react';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import TableRenderers from 'react-pivottable/TableRenderers';
import Plot from 'react-plotly.js';
import createPlotlyRenderers from 'react-pivottable/PlotlyRenderers';

// create Plotly renderers via dependency injection
const PlotlyRenderers = createPlotlyRenderers(Plot);

// see documentation for supported input formats
const data = [['attribute', 'attribute2'], ['value1', 'value2']];

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = props;
    }

    render() {
        return (
            <PivotTableUI
                data={data}
                onChange={s => this.setState(s)}
                renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
                {...this.state}
            />
        );
    }
}

ReactDOM.render(<App />, document.body);
```

#### With external `plotly.js`

If you would rather not install and bundle `plotly.js` but rather get it into
your app via something like `<script>` tag, you can ignore `react-plotly.js`'
peer-dependcy warning and handle the dependency injection like this:

```js
import React from 'react';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import TableRenderers from 'react-pivottable/TableRenderers';
import createPlotlyComponent from 'react-plotly.js/factory';
import createPlotlyRenderers from 'react-pivottable/PlotlyRenderers';

// create Plotly React component via dependency injection
const Plot = createPlotlyComponent(window.Plotly);

// create Plotly renderers via dependency injection
const PlotlyRenderers = createPlotlyRenderers(Plot);

// see documentation for supported input formats
const data = [['attribute', 'attribute2'], ['value1', 'value2']];

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = props;
    }

    render() {
        return (
            <PivotTableUI
                data={data}
                onChange={s => this.setState(s)}
                renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
                {...this.state}
            />
        );
    }
}

ReactDOM.render(<App />, document.body);
```

## Properties and layered architecture

* `<PivotTableUI {...props} />`
  * `<PivotTable {...props} />`
    * `<Renderer {...props} />`
      * `PivotData(props)`

The interactive component provided by `react-pivottable` is `PivotTableUI`, but
output rendering is delegated to the non-interactive `PivotTable` component,
which accepts a subset of its properties. `PivotTable` can be invoked directly
and is useful for outputting non-interactive saved snapshots of `PivotTableUI`
configurations. `PivotTable` in turn delegates to a specific renderer component,
such as the default `TableRenderer`, which accepts a subset of the same
properties. Finally, most renderers will create non-React `PivotData` object to
handle the actual computations, which also accepts a subset of the same props as
the rest of the stack.

Here is a table of the properties accepted by this stack, including an
indication of which layer consumes each, from the bottom up:

| Layer          | Key & Type                                       | Default Value                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PivotData`    | `data` <br /> see below for formats              | (none, required)              | data to be summarized                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PivotData`    | `rows` <br /> array of strings                   | `[]`                          | attribute names to prepopulate in row area                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PivotData`    | `cols` <br /> array of strings                   | `[]`                          | attribute names to prepopulate in cols area                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PivotData`    | `aggregators` <br /> object of functions         | `aggregators` from `Utilites` | dictionary of generators for aggregation functions in dropdown (see [original PivotTable.js documentation](https://github.com/nicolaskruchten/pivottable/wiki/Aggregators))                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PivotData`    | `vals` <br /> array of strings                   | `[]`                          | legacy shortcut for specifying the arguments to the primary aggregation. When `aggregations` is omitted, these values are used (and auto-filled as needed) for the implicit aggregation; when `aggregations` is supplied they are ignored.                                                                                                                                                                                                                                                                                                                               |
| `PivotData`    | `aggregatorName` <br /> string                   | first key in `aggregators`    | legacy shortcut for choosing the primary aggregator when `aggregations` is omitted. Ignored whenever `aggregations` is provided.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `PivotData`    | `aggregations` <br /> array of objects           | `[{aggregatorName: first key in \`aggregators\`}]` | configuration for all measures. Each object can contain `key`, `aggregatorName`, `vals`, and an optional `label`. Use this to compute one or many aggregator/value combinations simultaneously (e.g. `[{aggregatorName: 'Count', vals: ['Party Size']}, {aggregatorName: 'Average', vals: ['Tip']}]`). If omitted, a single aggregation using either `aggregatorName`/`vals` (if provided) or the first registered aggregator is created automatically.                                                                                                                                                 |
| `PivotData`    | `valueFilter` <br /> object of arrays of strings | `{}`                          | object whose keys are attribute names and values are objects of attribute value-boolean pairs which denote records to include or exclude from computation and rendering; used to prepopulate the filter menus that appear on double-click                                                                                                                                                                                                                                                                                                                                                                                              |
| `PivotData`    | `sorters` <br /> object or function              | `{}`                          | accessed or called with an attribute name and can return a [function which can be used as an argument to `array.sort`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) for output purposes. If no function is returned, the default sorting mechanism is a built-in "natural sort" implementation. Useful for sorting attributes like month names, see [original PivotTable.js example 1](http://nicolas.kruchten.com/pivottable/examples/mps_agg.html) and [original PivotTable.js example 2](http://nicolas.kruchten.com/pivottable/examples/montreal_2014.html). |
| `PivotData`    | `rowOrder` <br /> string                         | `"key_a_to_z"`                | the order in which row data is provided to the renderer, must be one of `"key_a_to_z"`, `"value_a_to_z"`, `"value_z_to_a"`, ordering by value orders by row total                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PivotData`    | `colOrder` <br /> string                         | `"key_a_to_z"`                | the order in which column data is provided to the renderer, must be one of `"key_a_to_z"`, `"value_a_to_z"`, `"value_z_to_a"`, ordering by value orders by column total                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PivotData`    | `derivedAttributes` <br /> object of functions   | `{}`                          | defines derived attributes (see [original PivotTable.js documentation](https://github.com/nicolaskruchten/pivottable/wiki/Derived-Attributes))                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Renderer`     | `<any>`                                          | (none, optional)              | Renderers may accept any additional properties                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PivotTable`   | `renderers` <br /> object of functions           | `TableRenderers`              | dictionary of renderer components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PivotTable`   | `rendererName` <br /> string                     | first key in `renderers`      | key to `renderers` object specifying the renderer to use                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PivotTableUI` | `onChange` <br /> function                       | (none, required)              | function called every time anything changes in the UI, with the new value of the properties needed to render the new state. This function must be hooked into a state-management system in order for the "dumb" `PivotTableUI` component to work.                                                                                                                                                                                                                                                                                                                                                             |
| `PivotTableUI` | `hiddenAttributes` <br /> array of strings       | `[]`                          | contains attribute names to omit from the UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PivotTableUI` | `hiddenFromAggregators` <br /> array of strings  | `[]`                          | contains attribute names to omit from the aggregator arguments dropdowns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PivotTableUI` | `hiddenFromDragDrop` <br /> array of strings     | `[]`                          | contains attribute names to omit from the drag'n'drop portion of the UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PivotTableUI` | `menuLimit` <br /> integer                       | 500                           | maximum number of values to list in the double-click menu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PivotTableUI` | `unusedOrientationCutoff` <br /> integer         | 85                            | If the attributes' names' combined length in characters exceeds this value then the unused attributes area will be shown vertically to the left of the UI instead of horizontally above it. `0` therefore means 'always vertical', and `Infinity` means 'always horizontal'.                                                                                                                                                                                                                                                                                                                                  |
| `Renderer`     | `tableOptions` <br /> object                     | `{}`                          | object containing table renderer options including `clickCallback` function, `conditionalFormatting`, `cellFormatting`, and aggregation display settings (see below)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PivotTableUI` | `colSorts` <br /> object                         | `{}`                          | object whose keys are column attribute names and values are `'ASC'` or `'DESC'` to control column sorting direction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PivotTableUI` | `rowSorts` <br /> object                         | `{}`                          | object whose keys are row attribute names and values are `'ASC'` or `'DESC'` to control row sorting direction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Working with multiple aggregators

You can now configure a stack of aggregations, each with its own aggregator + value selection:

```js
const aggregations = [
  {key: 'count-size', aggregatorName: 'Count', vals: ['Party Size']},
  {key: 'count-gender', aggregatorName: 'Count', vals: ['Payer Gender']},
  {key: 'avg-tip', aggregatorName: 'Average', vals: ['Tip']},
];
```

Pass that array via the `aggregations` prop (or add/remove them through the updated `PivotTableUI`). Each aggregation behaves like its own “value” in the table renderer, and you can mix and match as many as you like. Renderers that only support a single metric (e.g. the Plotly charts) continue to use the first aggregation as the primary one.

If you want to read the value of a specific aggregation programmatically, call `pivotData.getAggregator(rowKey, colKey, aggregationKey)` where `aggregationKey` matches the `key` you provided (or the aggregator name if keys are omitted).

You can also control whether multiple aggregations are displayed as extra **rows** or as extra **columns** in the table renderer via `tableOptions.aggregationDisplayMode`:

```js
tableOptions: {
  aggregationDisplayMode: 'row',    // or 'column'
}
```

The same setting is exposed in the `PivotTableUI` via the “Aggregation values on: Rows / Columns” dropdown in the aggregator area.

### Conditional Formatting

You can apply conditional formatting rules to cells in the table renderer. This allows you to highlight cells based on their values using custom styles.

Conditional formatting is configured via the `tableOptions.conditionalFormatting` property. You can either set it programmatically or use the built-in UI in `PivotTableUI` (click the "Conditional Formatting" button in the aggregator area).

#### Configuration

```js
tableOptions: {
  conditionalFormatting: {
    rules: [
      {
        condition: {
          type: 'greaterThan',
          value: 20
        },
        style: {
          backgroundColor: '#90EE90',
          color: '#000000',
          fontWeight: 'bold',
          fontStyle: 'normal'
        }
      },
      {
        condition: {
          type: 'lessThan',
          value: 5
        },
        style: {
          backgroundColor: '#FFB6C1',
          color: '#8B0000'
        }
      }
    ]
  }
}
```

#### Condition Types

- `greaterThan` - Value is greater than the condition value
- `lessThan` - Value is less than the condition value
- `greaterThanOrEqual` - Value is greater than or equal to the condition value
- `lessThanOrEqual` - Value is less than or equal to the condition value
- `equal` - Value equals the condition value (works with numbers and strings)
- `notEqual` - Value does not equal the condition value
- `empty` - Value is empty, null, undefined, or NaN (does not require a condition value)
- `notEmpty` - Value is not empty (does not require a condition value)
- `contains` - String value contains the condition value (case-insensitive)
- `notContains` - String value does not contain the condition value (case-insensitive)

#### Style Properties

- `backgroundColor` - Background color (CSS color value, e.g., `'#90EE90'` or `'rgb(144, 238, 144)'`)
- `color` - Text color (CSS color value)
- `fontWeight` - Font weight (`'normal'`, `'bold'`, `'lighter'`)
- `fontStyle` - Font style (`'normal'`, `'italic'`, `'oblique'`)

Rules are evaluated in order, and the first matching rule's style is applied. Conditional formatting styles take precedence over heatmap colors.

### Cell Formatting

You can control how numeric cell values (including totals) are formatted via the `tableOptions.cellFormatting` property. This lets you configure thousands separators, decimal separators, decimal places, and optional prefixes/suffixes (for example, to display currency or percentages).

Cell formatting is configured with a `rules` array similar to conditional formatting, but only the first rule is used for formatting:

```js
tableOptions: {
  cellFormatting: {
    rules: [
      {
        format: {
          thousandsSep: ',',
          decimalSep: '.',
          decimalPlaces: 2,
          prefix: '$',
          suffix: '',
        },
      },
    ],
  },
}
```

Formatting is applied only to numeric values; non-numeric values (like dates or text labels) are left as-is. Clearing all `cellFormatting.rules` will revert cells back to their unformatted numeric values.

### Column and Row Sorting

You can enable interactive sorting for individual column and row attributes by providing `colSorts` and `rowSorts` props. Click the sort buttons (↔ for columns, ⇅ for rows) next to attribute labels in the table headers to cycle through sort states: ascending → descending → no sort.

```js
// Initialize with some sorts
colSorts: {
  'Category': 'ASC',
  'Region': 'DESC'
},
rowSorts: {
  'Product': 'ASC'
}

// Handle sort changes
onColSort={(attr, sortDir) => {
  // sortDir is 'ASC', 'DESC', or null
  const colSorts = { ...this.state.colSorts };
  if (sortDir === null) {
    delete colSorts[attr];
  } else {
    colSorts[attr] = sortDir;
  }
  this.setState({ colSorts });
}}

onRowSort={(attr, sortDir) => {
  // Similar handling for row sorts
}}
```

Note: `colSorts` and `rowSorts` control sorting of individual attributes, while `colOrder` and `rowOrder` control the overall ordering strategy (by key or by value totals).

### Cell Click Callbacks

You can add click handlers to table cells via the `tableOptions.clickCallback` property:

```js
tableOptions: {
  clickCallback: function(e, value, filters, pivotData) {
    // e - the click event
    // value - the cell value
    // filters - object with attribute-value pairs for the clicked cell
    // pivotData - the PivotData instance for accessing underlying records
    console.log('Clicked cell with value:', value);
    console.log('Filters:', filters);
    
    // Access underlying records
    pivotData.forEachMatchingRecord(filters, function(record) {
      console.log('Matching record:', record);
    });
  }
}
```

### Accepted formats for `data`

#### Arrays of objects

One object per record, the object's keys are the attribute names.

_Note_: missing attributes or attributes with a value of `null` are treated as
if the value was the string `"null"`.

```js
const data = [
    {
        attr1: 'value1_attr1',
        attr2: 'value1_attr2',
        //...
    },
    {
        attr1: 'value2_attr1',
        attr2: 'value2_attr2',
        //...
    },
    //...
];
```

#### Arrays of arrays

One sub-array per record, the first sub-array contains the attribute names. If
subsequent sub-arrays are shorter than the first one, the trailing values are
treated as if they contained the string value `"null"`. If subsequent sub-arrays
are longer than the first one, excess values are ignored. This format is
compatible with the output of CSV parsing libraries like PapaParse.

```js
const data = [
    ['attr1', 'attr2'],
    ['value1_attr1', 'value1_attr2'],
    ['value2_attr1', 'value2_attr2'],
    //...
];
```

#### Functions that call back

The function will be called with a callback that takes an object as a parameter.

_Note_: missing attributes or attributes with a value of `null` are treated as
if the value was the string `"null"`.

```js
const data = function(callback) {
    callback({
        "attr1": "value1_attr1",
        "attr2": "value1_attr2",
        //...
    });
    callback({
        "attr1": "value2_attr1",
        "attr2": "value2_attr2",
        //...
    };
    //...
};
```
