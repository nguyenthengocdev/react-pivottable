import React from 'react';
import PropTypes from 'prop-types';
import { PivotData } from './Utilities';

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

  if (categoryLabel && datumLabel) {
    return `${categoryLabel} - ${datumLabel}`;
  }
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
        for (const datumKey of datumKeys) {
          const val = parseFloat(
            pivotData
              .getAggregator(
                transpose ? datumKey : traceKey,
                transpose ? traceKey : datumKey
              )
              .value()
          );
          values.push(isFinite(val) ? val : null);
          labels.push(datumKey.join('-') || ' ');
        }
        const trace = { name: traceKey.join('-') || fullAggName };
        if (traceOptions.type === 'pie') {
          trace.values = values;
          trace.labels = labels.length > 1 ? labels : [fullAggName];
        } else {
          trace.x = transpose ? values : labels;
          trace.y = transpose ? labels : values;
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
  traceOptions
) {
  const values = [];
  const labels = [];

  for (const categoryKey of categoryKeys) {
    for (const datumKey of datumKeys) {
      const val = parseFloat(
        pivotData
          .getAggregator(categoryKey, datumKey, aggregation.key)
          .value()
      );
      if (isFinite(val) && val !== null) {
        values.push(val);
        labels.push(combineCategoryLabels(categoryKey, datumKey));
      }
    }
  }

  const trace = {
    name: aggregation.label || aggregation.key,
    values: values.length > 0 ? values : [0],
    labels: labels.length > 0 ? labels : ['No Data'],
    title: {
      text: aggregation.label || aggregation.key,
    },
    hovertemplate: '<b>Type:</b> %{label}<br><b>Count:</b> %{value}<extra></extra>',
  };

  const mergedTrace = Object.assign({}, traceOptions, trace);
  mergedTrace.textinfo = 'value';
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
  traceOptions
) {
  const traces = [];

  aggregations.forEach((aggregation) => {
    const { values, labels } = collectAggregationData(
      pivotData,
      categoryKeys,
      datumKeys,
      aggregation.key
    );

    const trace = {
      name: aggregation.label || aggregation.key,
      xaxis: `x${groupIndex + 1}`,
      yaxis: `y${groupIndex + 1}`,
      x: labels,
      y: values,
    };

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
        };

        // Create a separate subplot for each aggregation
        allAggregations.forEach((aggregation, index) => {
          const trace = createPieCategoryTrace(
            pivotData,
            aggregation,
            categoryKeys,
            datumKeys,
            index,
            traceOptions
          );

          // Use grid layout positioning - let Plotly handle domain automatically
          // Set domain to specify which grid cell this pie belongs to
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
      };

      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();
      const categoryKeys = ensureNonEmptyKeys(rowKeys);
      const datumKeys = ensureNonEmptyKeys(colKeys);

      groupNames.forEach((groupName, groupIndex) => {
        const aggregations = groupedAggregations[groupName];

        // All other charts show category-level data
        const traces = createCategoryDataTraces(
          pivotData,
          aggregations,
          categoryKeys,
          datumKeys,
          groupIndex,
          traceOptions
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

      const data = { x: [], y: [], text: [], type: 'scatter', mode: 'markers' };

      // Use forEach instead of map since we're not returning values
      rowKeys.forEach(rowKey => {
        colKeys.forEach(colKey => {
          const v = pivotData.getAggregator(rowKey, colKey).value();
          if (v !== null) {
            data.x.push(colKey.join('-'));
            data.y.push(rowKey.join('-'));
            data.text.push(v);
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
    // Grouped by Type renderers (new feature)
    'Grouped Bars by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'bar', orientation: 'h' },
      { barmode: 'group' }
    ),
    'Grouped Columns by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'bar' },
      { barmode: 'group' }
    ),
    'Grouped Lines by Type': makeGroupedRenderer(
      PlotlyComponent,
      { mode: 'lines+markers' }
    ),
    'Grouped Areas by Type': makeGroupedRenderer(
      PlotlyComponent,
      { stackgroup: 1 }
    ),
    'Grouped Scatters by Type': makeGroupedRenderer(
      PlotlyComponent,
      { mode: 'markers' }
    ),
    'Grouped Pies by Type': makeGroupedRenderer(
      PlotlyComponent,
      { type: 'pie', hoverinfo: 'label+value' }
    ),
  };
}
