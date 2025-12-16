import React from 'react';
import PropTypes from 'prop-types';
import {aggregationNames, PivotData} from './Utilities';
import {applyCellFormatting} from './TableRenderers';

const CHART_WIDTH_RATIO = 1.5; // Ratio to scale down from full window width
const CHART_HEIGHT_RATIO = 1.4; // Ratio to scale down from full window height
const CHART_HEIGHT_OFFSET = 50; // Fixed offset to subtract from height calculation

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensures keys array is not empty by adding an empty array if needed
 */
function ensureNonEmptyKeys(keys) {
  return keys.length > 0 ? keys : [[]];
}

/**
 * Builds axis title from row and column titles
 */
function buildAxisTitle(
  categoryTitle,
  datumTitle,
  defaultTitle = 'Categories'
) {
  if (categoryTitle && datumTitle) {
    return `${categoryTitle} - ${datumTitle}`;
  }
  return categoryTitle || datumTitle || defaultTitle;
}

/**
 * Strategy handlers for different aggregation types
 */
const aggregationStrategies = {
  // Sum-based aggregators accumulate values
  Sum: (currentValue, newValue) => (currentValue || 0) + newValue,
  Count: (currentValue, newValue) => (currentValue || 0) + newValue,
  'Integer Sum': (currentValue, newValue) => (currentValue || 0) + newValue,
  'Count Unique Values': (currentValue, newValue) =>
    (currentValue || 0) + newValue,
  'Sum over Sum': (currentValue, newValue) => (currentValue || 0) + newValue,
  'Sample Variance': (currentValue, newValue) => (currentValue || 0) + newValue,
  'Sample Standard Deviation': (currentValue, newValue) =>
    (currentValue || 0) + newValue,

  // Statistical aggregators collect values for calculation
  Average: {
    init: () => ({values: [], count: 0}),
    accumulate: (state, value) => {
      if (value !== null && isFinite(value)) {
        state.values.push(value);
        state.count++;
      }
      return state;
    },
    finalize: state => {
      if (state.count === 0) return null;
      const sum = state.values.reduce((a, b) => a + b, 0);
      return sum / state.count;
    },
  },

  Median: {
    init: () => ({values: []}),
    accumulate: (state, value) => {
      if (value !== null && isFinite(value)) {
        state.values.push(value);
      }
      return state;
    },
    finalize: state => {
      if (state.values.length === 0) return null;
      state.values.sort((a, b) => a - b);
      const mid = Math.floor(state.values.length / 2);
      return state.values.length % 2 === 0
        ? (state.values[mid - 1] + state.values[mid]) / 2
        : state.values[mid];
    },
  },

  // Selection aggregators choose specific values
  Minimum: (currentValue, newValue) => {
    if (currentValue === null || newValue < (currentValue || 0)) {
      return newValue;
    }
    return currentValue;
  },
  Maximum: (currentValue, newValue) => {
    if (newValue > (currentValue || 0)) {
      return newValue;
    }
    return currentValue;
  },
  First: (currentValue, newValue) => {
    return currentValue === null ? newValue : currentValue;
  },
  Last: (currentValue, newValue) => {
    return newValue === null && currentValue !== null ? currentValue : newValue;
  },
};

/**
 * Collects aggregation values and labels across all categories
 */
function collectAggregationData(
  pivotData,
  categoryKeys,
  datumKeys,
  aggregation,
  cellFormatting = null
) {
  const map = {};

  const aggregationHandler = aggregationStrategies[aggregation.aggregatorName];

  if (!aggregationHandler) {
    console.warn(`Unknown aggregator: ${aggregation.aggregatorName}`);
    return {values: [], labels: [], textValues: []};
  }

  const isStatefulAggregator =
    typeof aggregationHandler === 'object' &&
    aggregationHandler.init &&
    aggregationHandler.accumulate &&
    aggregationHandler.finalize;

  for (const categoryKey of categoryKeys) {
    for (const datumKey of datumKeys) {
      const aggregator = pivotData.getAggregator(
        categoryKey,
        datumKey,
        aggregation.key
      );
      const val = parseFloat(aggregator.value());

      const value = isFinite(val) ? val : null;
      const key = categoryKey[0] || datumKey[0];
      const label = key;

      if (!map[key]) {
        map[key] = {
          label,
          state: isStatefulAggregator ? aggregationHandler.init() : null,
          value: null,
        };
      }

      map[key].label = label;

      if (isStatefulAggregator) {
        map[key].state = aggregationHandler.accumulate(map[key].state, value);
      } else {
        map[key].value = aggregationHandler(map[key].value, value);
      }
    }
  }

  const values = [];
  const labels = [];
  for (const entry of Object.values(map)) {
    if (isStatefulAggregator) {
      values.push(aggregationHandler.finalize(entry.state));
    } else {
      values.push(entry.value);
    }
    labels.push(entry.label);
  }

  const textValues = cellFormatting
    ? values.map(value => {
        if (value === null) {
          return '';
        }

        return applyCellFormatting(
          value,
          cellFormatting,
          null,
          aggregation.aggregatorName
        );
      })
    : values.map(value => (value !== null ? value.toString() : ''));

  return {values, labels, textValues};
}

/**
 * Calculates chart dimensions
 */
function getChartDimensions(rowMultiplier = 1) {
  return {
    width: window.innerWidth / CHART_WIDTH_RATIO,
    height:
      (window.innerHeight / CHART_HEIGHT_RATIO - CHART_HEIGHT_OFFSET) *
      rowMultiplier,
  };
}

/**
 * Creates common renderer props
 */
function createRendererProps() {
  return {
    defaultProps: Object.assign({}, PivotData.defaultProps, {
      plotlyOptions: {},
      plotlyConfig: {},
    }),
    propTypes: Object.assign({}, PivotData.propTypes, {
      plotlyOptions: PropTypes.object,
      plotlyConfig: PropTypes.object,
      onRendererUpdate: PropTypes.func,
    }),
  };
}

/**
 * Determines chart rendering strategy based on trace options
 */
function getChartRenderingStrategy(traceOptions) {
  if (traceOptions.type === 'pie') {
    return 'pie-totals';
  }

  return 'category-data';
}

// ============================================================================
// Renderer Factory Functions
// ============================================================================

function makeRenderer(
  PlotlyComponent,
  traceOptions = {},
  layoutOptions = {},
  transpose = false
) {
  class Renderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();
      const traceKeys = ensureNonEmptyKeys(transpose ? colKeys : rowKeys);
      const datumKeys = ensureNonEmptyKeys(transpose ? rowKeys : colKeys);

      const primaryAggregation = pivotData.getPrimaryAggregation();
      const fallbackAggregator =
        Object.keys(this.props.aggregators)[0] || 'Value';
      const aggregatorName =
        (primaryAggregation && primaryAggregation.aggregatorName) ||
        fallbackAggregator;
      const aggregationVals =
        (primaryAggregation && primaryAggregation.vals) || [];
      const fullAggName =
        (primaryAggregation && primaryAggregation.label) ||
        (aggregationVals.length
          ? `${aggregatorName} of ${aggregationVals.join(', ')}`
          : aggregatorName);

      const data = traceKeys.map(traceKey => {
        // Use collectAggregationData to get values and formatted text in one pass
        const {values, textValues} = collectAggregationData(
          pivotData,
          [traceKey],
          datumKeys,
          primaryAggregation && primaryAggregation.key,
          this.props.plotlyOptions && this.props.plotlyOptions.cellFormatting
        );

        const labels = datumKeys.map(datumKey => datumKey.join('-') || ' ');

        const trace = {
          name: traceKey.join('-') || fullAggName,
          text: textValues,
        };

        if (traceOptions.type === 'pie') {
          trace.values = values;
          trace.labels = labels.length > 1 ? labels : [fullAggName];
          trace.hovertemplate =
            '<b>%{label}</b><br>' +
            fullAggName +
            '<br><b>%{value}</b><extra></extra>';
          trace.textinfo = 'value';
          trace.textposition = 'inside';
        } else {
          trace.x = transpose ? values : labels;
          trace.y = transpose ? labels : values;
          trace.hovertemplate = transpose
            ? '<b>%{y}</b><br>' + fullAggName + '<br><b>%{x}</b><extra></extra>'
            : '<b>%{x}</b><br>' +
              fullAggName +
              '<br><b>%{y}</b><extra></extra>';

          // Configure text display based on chart type
          if (traceOptions.type === 'bar') {
            trace.textposition =
              traceOptions.orientation === 'h' ? 'middle right' : 'outside';
            trace.textmode = 'text';
          } else if (traceOptions.mode && traceOptions.mode.includes('lines')) {
            trace.textposition = 'top center';
            trace.textmode = 'lines+markers+text'; // Show text on markers for line charts
          } else if (traceOptions.mode === 'markers') {
            trace.textposition = 'middle right';
            trace.textmode = 'text+markers'; // Show text with markers
          } else if (traceOptions.stackgroup) {
            trace.textposition = 'middle center';
            trace.textmode = 'text';
          } else {
            trace.textposition = 'outside';
            trace.textmode = 'text';
          }
        }

        return Object.assign(trace, traceOptions);
      });

      let titleText = fullAggName;
      const hAxisTitle = transpose
        ? this.props.rows.join('-')
        : this.props.cols.join('-');
      const groupByTitle = transpose
        ? this.props.cols.join('-')
        : this.props.rows.join('-');
      if (hAxisTitle !== '') {
        titleText += ` vs ${hAxisTitle}`;
      }
      if (groupByTitle !== '') {
        titleText += ` by ${groupByTitle}`;
      }

      const dimensions = getChartDimensions();
      const layout = {
        title: titleText,
        hovermode: 'closest',
        width: dimensions.width,
        height: dimensions.height,
      };

      if (traceOptions.type === 'pie') {
        const columns = Math.ceil(Math.sqrt(data.length));
        const rows = Math.ceil(data.length / columns);
        layout.grid = {columns, rows};
        data.forEach((d, i) => {
          d.domain = {
            row: Math.floor(i / columns),
            column: i - columns * Math.floor(i / columns),
          };
          if (data.length > 1) {
            d.title = d.name;
          }
        });
        if (data[0].labels.length === 1) {
          layout.showlegend = false;
        }
      } else {
        layout.xaxis = {
          title: transpose ? fullAggName : null,
          automargin: true,
        };
        layout.yaxis = {
          title: transpose ? null : fullAggName,
          automargin: true,
        };
      }

      return (
        <PlotlyComponent
          data={data}
          layout={Object.assign(
            layout,
            layoutOptions,
            this.props.plotlyOptions
          )}
          config={this.props.plotlyConfig}
          onUpdate={this.props.onRendererUpdate}
        />
      );
    }
  }

  const rendererProps = createRendererProps();
  Renderer.defaultProps = rendererProps.defaultProps;
  Renderer.propTypes = rendererProps.propTypes;

  return Renderer;
}

/**
 * Creates a pie chart trace showing category-level breakdown for a single aggregation
 */
function createPieCategoryTrace(
  pivotData,
  aggregation,
  categoryKeys,
  datumKeys,
  subplotIndex,
  traceOptions,
  cellFormatting = null,
  attributeName = ''
) {
  // Use collectAggregationData to get formatted values in one pass
  const {values, labels, textValues} = collectAggregationData(
    pivotData,
    categoryKeys,
    datumKeys,
    aggregation,
    cellFormatting
  );

  const trace = {
    name: aggregation.label || aggregation.key,
    values: values.length > 0 ? values : [0],
    labels: labels.length > 0 ? labels : ['No Data'],
    text: textValues.length > 0 ? textValues : ['No Data'],
    title: {
      text: aggregation.label || aggregation.key,
    },
    hovertemplate: `${attributeName}: <b>%{label}</b><br>${aggregation.label || aggregation.key}: <b>%{text}</b><extra></extra>`,
  };

  const mergedTrace = Object.assign({}, traceOptions, trace);
  mergedTrace.textinfo = 'text';
  mergedTrace.textposition = 'inside';

  return mergedTrace;
}

/**
 * Creates traces for charts showing category-level data
 */
function createCategoryDataTraces(
  pivotData,
  aggregations,
  categoryKeys,
  datumKeys,
  groupIndex,
  traceOptions,
  plotlyOptions,
  attributeName
) {
  const traces = [];

  aggregations.forEach(aggregation => {
    const {values, labels, textValues} = collectAggregationData(
      pivotData,
      categoryKeys,
      datumKeys,
      aggregation,
      plotlyOptions && plotlyOptions.cellFormatting
    );

    const trace = {
      name: aggregation.label || aggregation.key,
      xaxis: `x${groupIndex + 1}`,
      yaxis: `y${groupIndex + 1}`,
      x: labels,
      y: values,
      text: textValues,
      hovertemplate: `${attributeName}: <b>%{x}</b><br>${aggregation.label ||
        aggregation.key}: <b>%{text}</b><extra></extra>`,
    };

    if (plotlyOptions && plotlyOptions.displayText) {
      if (traceOptions.type === 'bar') {
        trace.textposition =
          traceOptions.orientation === 'h' ? 'middle right' : 'outside';
        traceOptions.mode = 'text';
      } else if (traceOptions.mode && traceOptions.mode.includes('lines')) {
        trace.textposition = 'top';
        traceOptions.mode = 'lines+markers+text';
      } else if (traceOptions.mode && traceOptions.mode.includes('markers')) {
        trace.textposition = 'top center';
        traceOptions.mode = 'markers+text';
      } else {
        trace.textposition = 'top center';
        traceOptions.mode = 'text';
      }
    }

    traces.push(Object.assign(trace, traceOptions));
  });

  return traces;
}

/**
 * Creates axis configuration for a subplot group
 */
function createGroupedSubplotAxes(
  groupIndex,
  aggregations,
  rowsTitle,
  colsTitle,
  showXAxisTitle = true
) {
  const primaryAgg = aggregations[0];
  const aggName = primaryAgg.aggregatorName;
  const xAxisTitle = showXAxisTitle
    ? buildAxisTitle(rowsTitle, colsTitle)
    : null;

  return {
    [`xaxis${groupIndex + 1}`]: {
      title: xAxisTitle,
      showticklabels: false,
      automargin: true,
    },
    [`yaxis${groupIndex + 1}`]: {
      title: aggName,
      automargin: true,
    },
  };
}

function makeGroupedRenderer(
  PlotlyComponent,
  traceOptions = {},
  layoutOptions = {}
) {
  class Renderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const renderingStrategy = getChartRenderingStrategy(traceOptions);

      const unsupportedAggregations = [
        aggregationNames['List Unique Values'],
        aggregationNames['Count as Fraction of Columns'],
        aggregationNames['Count as Fraction of Rows'],
        aggregationNames['Count as Fraction of Total'],
        aggregationNames['Sum as Fraction of Columns'],
        aggregationNames['Sum as Fraction of Rows'],
        aggregationNames['Sum as Fraction of Total'],
      ];

      const attributeName = this.props.rows[0] || this.props.cols[0];

      // For pie charts, treat each aggregation as a separate subplot
      if (renderingStrategy === 'pie-totals') {
        const allAggregations = pivotData
          .getAggregations()
          .filter(
            aggregation =>
              !unsupportedAggregations.includes(aggregation.aggregatorName)
          );

        if (allAggregations.length === 0) {
          return <div>No aggregations to display</div>;
        }

        const rowKeys = pivotData.getRowKeys();
        const colKeys = pivotData.getColKeys();
        const categoryKeys = ensureNonEmptyKeys(rowKeys);
        const datumKeys = ensureNonEmptyKeys(colKeys);

        const data = [];
        const columns = Math.ceil(Math.sqrt(allAggregations.length));
        const rows = Math.ceil(allAggregations.length / columns);
        const dimensions = getChartDimensions(rows);

        const layout = {
          title: 'Aggregations',
          grid: {rows, columns, pattern: 'independent'},
          width: dimensions.width,
          height: dimensions.height,
          showlegend: true,
          hovermode: 'closest',
        };

        // Create a separate subplot for each aggregation
        allAggregations.forEach((aggregation, index) => {
          const trace = createPieCategoryTrace(
            pivotData,
            aggregation,
            categoryKeys,
            datumKeys,
            index,
            traceOptions,
            this.props.plotlyOptions && this.props.plotlyOptions.cellFormatting,
            attributeName
          );

          trace.domain = {
            row: Math.floor(index / columns),
            column: index % columns,
          };

          data.push(trace);
        });

        return (
          <PlotlyComponent
            data={data}
            layout={Object.assign(
              layout,
              layoutOptions,
              this.props.plotlyOptions
            )}
            config={this.props.plotlyConfig}
            onUpdate={this.props.onRendererUpdate}
          />
        );
      }

      // For non-pie charts, group by aggregation type
      const groupedAggregations = pivotData.groupAggregationsByType();
      const groupNames = Object.keys(groupedAggregations).filter(
        aggregation => !unsupportedAggregations.includes(aggregation)
      );

      if (groupNames.length === 0) {
        return <div>No aggregations to display</div>;
      }

      const rows = groupNames.length;

      const data = [];
      const dimensions = getChartDimensions(rows);
      const layout = {
        title: 'Grouped Aggregations by Type',
        grid: {rows, columns: 1, pattern: 'independent'},
        width: dimensions.width,
        height: dimensions.height,
        hovermode: 'closest',
      };

      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();

      const categoryKeys = ensureNonEmptyKeys(rowKeys);
      const datumKeys = ensureNonEmptyKeys(colKeys);

      groupNames.forEach((groupName, groupIndex) => {
        const aggregations = groupedAggregations[groupName];

        const traces = createCategoryDataTraces(
          pivotData,
          aggregations,
          categoryKeys,
          datumKeys,
          groupIndex,
          traceOptions,
          this.props.plotlyOptions,
          attributeName
        );
        data.push(...traces);

        Object.assign(
          layout,
          createGroupedSubplotAxes(
            groupIndex,
            aggregations,
            this.props.rows.join('-'),
            this.props.cols.join('-'),
            false
          )
        );
      });

      return (
        <PlotlyComponent
          data={data}
          layout={Object.assign(
            layout,
            layoutOptions,
            this.props.plotlyOptions
          )}
          config={this.props.plotlyConfig}
          onUpdate={this.props.onRendererUpdate}
        />
      );
    }
  }

  const rendererProps = createRendererProps();
  Renderer.defaultProps = rendererProps.defaultProps;
  Renderer.propTypes = rendererProps.propTypes;

  return Renderer;
}

function makeScatterRenderer(PlotlyComponent) {
  class Renderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const rowKeys = ensureNonEmptyKeys(pivotData.getRowKeys());
      const colKeys = ensureNonEmptyKeys(pivotData.getColKeys());

      const data = {
        x: [],
        y: [],
        text: [],
        type: 'scatter',
        mode: 'markers+text',
        textposition: 'middle right',
        hovertemplate: '<b>%{x}</b><br>%{y}<br><b>%{text}</b><extra></extra>',
      };

      // Use forEach instead of map since we're not returning values
      rowKeys.forEach(rowKey => {
        colKeys.forEach(colKey => {
          const aggregator = pivotData.getAggregator(rowKey, colKey);
          const v = aggregator.value();
          if (v !== null) {
            data.x.push(colKey.join('-'));
            data.y.push(rowKey.join('-'));
            data.text.push(aggregator.format(v));
          }
        });
      });

      const dimensions = getChartDimensions();
      const layout = {
        title: `${this.props.rows.join('-')} vs ${this.props.cols.join('-')}`,
        hovermode: 'closest',
        xaxis: {title: this.props.cols.join('-'), automargin: true},
        yaxis: {title: this.props.rows.join('-'), automargin: true},
        width: dimensions.width,
        height: dimensions.height,
      };

      return (
        <PlotlyComponent
          data={[data]}
          layout={Object.assign(layout, this.props.plotlyOptions)}
          config={this.props.plotlyConfig}
          onUpdate={this.props.onRendererUpdate}
        />
      );
    }
  }

  const rendererProps = createRendererProps();
  Renderer.defaultProps = rendererProps.defaultProps;
  Renderer.propTypes = rendererProps.propTypes;

  return Renderer;
}

export default function createPlotlyRenderers(PlotlyComponent) {
  return {
    'Grouped Column Chart': makeRenderer(
      PlotlyComponent,
      {type: 'bar'},
      {barmode: 'group'}
    ),
    'Stacked Column Chart': makeRenderer(
      PlotlyComponent,
      {type: 'bar'},
      {barmode: 'relative'}
    ),
    'Grouped Bar Chart': makeRenderer(
      PlotlyComponent,
      {type: 'bar', orientation: 'h'},
      {barmode: 'group'},
      true
    ),
    'Stacked Bar Chart': makeRenderer(
      PlotlyComponent,
      {type: 'bar', orientation: 'h'},
      {barmode: 'relative'},
      true
    ),
    'Line Chart': makeRenderer(PlotlyComponent),
    'Dot Chart': makeRenderer(PlotlyComponent, {mode: 'markers'}, {}, true),
    'Area Chart': makeRenderer(PlotlyComponent, {stackgroup: 1}),
    'Scatter Chart': makeScatterRenderer(PlotlyComponent),
    'Multiple Pie Chart': makeRenderer(
      PlotlyComponent,
      {type: 'pie', scalegroup: 1, hoverinfo: 'label+value', textinfo: 'none'},
      {},
      true
    ),
    'Grouped Bars by Type': makeGroupedRenderer(
      PlotlyComponent,
      {type: 'bar', orientation: 'h'},
      {barmode: 'group'}
    ),
    'Grouped Columns by Type': makeGroupedRenderer(
      PlotlyComponent,
      {type: 'bar'},
      {barmode: 'group'}
    ),
    'Grouped Lines by Type': makeGroupedRenderer(PlotlyComponent, {
      mode: 'lines+markers',
    }),
    'Grouped Areas by Type': makeGroupedRenderer(PlotlyComponent, {
      stackgroup: 1,
    }),
    'Grouped Scatters by Type': makeGroupedRenderer(PlotlyComponent, {
      mode: 'markers',
    }),
    'Grouped Pies by Type': makeGroupedRenderer(PlotlyComponent, {type: 'pie'}),
  };
}
