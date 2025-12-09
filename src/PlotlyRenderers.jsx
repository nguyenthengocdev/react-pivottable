import React from 'react';
import PropTypes from 'prop-types';
import { PivotData } from './Utilities';
import { applyCellFormatting } from './TableRenderers';

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
 * Combines category and datum labels into a single display label
 */
function combineCategoryLabels(categoryKey, datumKey) {
  const categoryLabel = categoryKey.join(' ') || '';
  const datumLabel = datumKey.join(' ') || '';

  // if (categoryLabel && datumLabel) {
  //   return `${categoryLabel} - ${datumLabel}`;
  // }
  return categoryLabel || datumLabel || ' ';
}

/**
 * Builds axis title from row and column titles
 */
function buildAxisTitle(categoryTitle, datumTitle, defaultTitle = 'Categories') {
  if (categoryTitle && datumTitle) {
    return `${categoryTitle} - ${datumTitle}`;
  }
  return categoryTitle || datumTitle || defaultTitle;
}

/**
 * Collects aggregation values and labels across all categories
 */
function collectAggregationData(pivotData, categoryKeys, datumKeys, aggregationKey) {
  const values = [];
  const labels = [];

  for (const categoryKey of categoryKeys) {
    for (const datumKey of datumKeys) {
      const val = parseFloat(
        pivotData
          .getAggregator(categoryKey, datumKey, aggregationKey)
          .value()
      );
      values.push(isFinite(val) ? val : null);
      labels.push(combineCategoryLabels(categoryKey, datumKey));
    }
  }

  return { values, labels };
}

/**
 * Calculates chart dimensions
 */
function getChartDimensions(rowMultiplier = 1) {
  return {
    width: window.innerWidth / CHART_WIDTH_RATIO,
    height: (window.innerHeight / CHART_HEIGHT_RATIO - CHART_HEIGHT_OFFSET) * rowMultiplier,
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
  if (traceOptions.mode && traceOptions.mode.includes('lines')) {
    return 'category-data';
  }
  // Bar, area, scatter charts also need category data
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
        const values = [];
        const labels = [];
        const textValues = [];

        for (const datumKey of datumKeys) {
          const aggregator = pivotData.getAggregator(
            transpose ? datumKey : traceKey,
            transpose ? traceKey : datumKey
          );
          const val = parseFloat(aggregator.value());
          // Get cell formatting from plotlyOptions (similar to tableOptions)
          const cellFormatting = (this.props.plotlyOptions && this.props.plotlyOptions.cellFormatting) || null;

          // Apply cell formatting to the formatted value
          const finalFormattedValue = applyCellFormatting(
            aggregator.value(),
            cellFormatting,
            aggregator.format.bind(aggregator),
            aggregatorName
          );
          values.push(isFinite(val) ? val : null);
          labels.push(datumKey.join('-') || ' ');
          textValues.push(finalFormattedValue);
        }

        const trace = {
          name: traceKey.join('-') || fullAggName,
          text: textValues,
        };

        if (traceOptions.type === 'pie') {
          trace.values = values;
          trace.labels = labels.length > 1 ? labels : [fullAggName];
          trace.hovertemplate = '<b>%{label}</b><br>' + fullAggName + '<br><b>%{value}</b><extra></extra>';
          trace.textinfo = 'value';
          trace.textposition = 'inside';
        } else {
          trace.x = transpose ? values : labels;
          trace.y = transpose ? labels : values;
          trace.hovertemplate = transpose
            ? '<b>%{y}</b><br>' + fullAggName + '<br><b>%{x}</b><extra></extra>'
            : '<b>%{x}</b><br>' + fullAggName + '<br><b>%{y}</b><extra></extra>';

          // Configure text display based on chart type
          if (traceOptions.type === 'bar') {
            trace.textposition = traceOptions.orientation === 'h' ? 'middle right' : 'outside';
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
        layout.grid = { columns, rows };
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
  cellFormatting = null
) {
  const values = [];
  const labels = [];

  for (const categoryKey of categoryKeys) {
    for (const datumKey of datumKeys) {
      const aggregator = pivotData.getAggregator(categoryKey, datumKey, aggregation.key);
      const val = parseFloat(aggregator.value());
      if (isFinite(val) && val !== null) {
        values.push(val);
        labels.push(combineCategoryLabels(categoryKey, datumKey));
      }
    }
  }

  const textValues = [];
  for (const categoryKey of categoryKeys) {
    for (const datumKey of datumKeys) {
      const aggregator = pivotData.getAggregator(categoryKey, datumKey, aggregation.key);

      const finalFormattedValue = applyCellFormatting(
        aggregator.value(),
        cellFormatting,
        aggregator.format.bind(aggregator),
        aggregation.aggregatorName
      );

      textValues.push(finalFormattedValue);
    }
  }

  const trace = {
    name: aggregation.label || aggregation.key,
    values: values.length > 0 ? values : [0],
    labels: labels.length > 0 ? labels : ['No Data'],
    text: textValues.length > 0 ? textValues : ['No Data'],
    title: {
      text: aggregation.label || aggregation.key,
    },
    hovertemplate: '<b>%{label}</b><br>' + (aggregation.label || aggregation.key) + '<br><b>%{text}</b><extra></extra>',
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
  cellFormatting = null
) {
  const traces = [];

  aggregations.forEach((aggregation) => {
    const { values, labels } = collectAggregationData(
      pivotData,
      categoryKeys,
      datumKeys,
      aggregation.key
    );

    // Get formatted text values for display
    const textValues = [];
    for (const categoryKey of categoryKeys) {
      for (const datumKey of datumKeys) {
        const aggregator = pivotData.getAggregator(categoryKey, datumKey, aggregation.key);
        const finalFormattedValue = applyCellFormatting(
          aggregator.value(),
          cellFormatting,
          aggregator.format.bind(aggregator),
          aggregation.aggregatorName
        );
        textValues.push(finalFormattedValue);
      }
    }

    const trace = {
      name: aggregation.label || aggregation.key,
      xaxis: `x${groupIndex + 1}`,
      yaxis: `y${groupIndex + 1}`,
      x: labels,
      y: values,
      text: textValues,
      hovertemplate: `<b>%{x}</b><br>${aggregation.label || aggregation.key}<br><b>%{text}</b><extra></extra>`,
    };

    if (traceOptions.type === 'bar') {
      trace.textposition = traceOptions.orientation === 'h' ? 'middle right' : 'outside';
      trace.textmode = 'text';
    } else if (traceOptions.mode && traceOptions.mode.includes('lines')) {
      trace.textposition = 'top';
    } else if (traceOptions.mode && traceOptions.mode.includes('markers')) {
      trace.textposition = 'top center';
    } else {
      trace.textposition = 'top center';
      trace.textmode = 'text';
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

      // For pie charts, treat each aggregation as a separate subplot
      if (renderingStrategy === 'pie-totals') {
        const allAggregations = pivotData.getAggregations();

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
          grid: { rows, columns, pattern: 'independent' },
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
            this.props.plotlyOptions && this.props.plotlyOptions.cellFormatting
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
      const groupNames = Object.keys(groupedAggregations);

      if (groupNames.length === 0) {
        return <div>No aggregations to display</div>;
      }

      const rows = groupNames.length;

      const data = [];
      const dimensions = getChartDimensions(rows);
      const layout = {
        title: 'Grouped Aggregations by Type',
        grid: { rows, columns: 1, pattern: 'independent' },
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
          this.props.plotlyOptions && this.props.plotlyOptions.cellFormatting
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
        xaxis: { title: this.props.cols.join('-'), automargin: true },
        yaxis: { title: this.props.rows.join('-'), automargin: true },
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
      { type: 'bar' },
      { barmode: 'group' }
    ),
    'Stacked Column Chart': makeRenderer(
      PlotlyComponent,
      { type: 'bar' },
      { barmode: 'relative' }
    ),
    'Grouped Bar Chart': makeRenderer(
      PlotlyComponent,
      { type: 'bar', orientation: 'h' },
      { barmode: 'group' },
      true
    ),
    'Stacked Bar Chart': makeRenderer(
      PlotlyComponent,
      { type: 'bar', orientation: 'h' },
      { barmode: 'relative' },
      true
    ),
    'Line Chart': makeRenderer(PlotlyComponent),
    'Dot Chart': makeRenderer(PlotlyComponent, { mode: 'markers' }, {}, true),
    'Area Chart': makeRenderer(PlotlyComponent, { stackgroup: 1 }),
    'Scatter Chart': makeScatterRenderer(PlotlyComponent),
    'Multiple Pie Chart': makeRenderer(
      PlotlyComponent,
      { type: 'pie', scalegroup: 1, hoverinfo: 'label+value', textinfo: 'none' },
      {},
      true
    ),
    'Grouped Bars by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'bar', orientation: 'h' },
      { barmode: 'group', }
    ),
    'Grouped Columns by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'bar' },
      { barmode: 'group' }
    ),
    'Grouped Lines by Type': makeGroupedRenderer(
      PlotlyComponent,
      { mode: 'lines+markers+text' }
    ),
    'Grouped Areas by Type': makeGroupedRenderer(
      PlotlyComponent,
      { stackgroup: 1 }
    ),
    'Grouped Scatters by Type': makeGroupedRenderer(
      PlotlyComponent,
      { mode: 'markers+text', }
    ),
    'Grouped Pies by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'pie' }
    ),
  };
}
