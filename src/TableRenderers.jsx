import React from 'react';
import PropTypes from 'prop-types';
import {PivotData, numberFormat} from './Utilities';

// helper function for setting row/col-span in pivotTableRenderer
const spanSize = function(arr, i, j) {
  let x;
  if (i !== 0) {
    let asc, end;
    let noDraw = true;
    for (
      x = 0, end = j, asc = end >= 0;
      asc ? x <= end : x >= end;
      asc ? x++ : x--
    ) {
      if (arr[i - 1][x] !== arr[i][x]) {
        noDraw = false;
      }
    }
    if (noDraw) {
      return -1;
    }
  }
  let len = 0;
  while (i + len < arr.length) {
    let asc1, end1;
    let stop = false;
    for (
      x = 0, end1 = j, asc1 = end1 >= 0;
      asc1 ? x <= end1 : x >= end1;
      asc1 ? x++ : x--
    ) {
      if (arr[i][x] !== arr[i + len][x]) {
        stop = true;
      }
    }
    if (stop) {
      break;
    }
    len++;
  }
  return len;
};

function redColorScaleGenerator(values) {
  const min = Math.min.apply(Math, values);
  const max = Math.max.apply(Math, values);
  return x => {
    // eslint-disable-next-line no-magic-numbers
    const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
    return {backgroundColor: `rgb(255,${nonRed},${nonRed})`};
  };
}

// Conditional formatting evaluation function
function evaluateCondition(value, condition) {
  if (!condition || !condition.type) {
    return false;
  }

  const {type, value: conditionValue} = condition;
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const numConditionValue =
    typeof conditionValue === 'number'
      ? conditionValue
      : parseFloat(conditionValue);

  switch (type) {
    case 'greaterThan':
      return (
        !isNaN(numValue) &&
        !isNaN(numConditionValue) &&
        numValue > numConditionValue
      );
    case 'lessThan':
      return (
        !isNaN(numValue) &&
        !isNaN(numConditionValue) &&
        numValue < numConditionValue
      );
    case 'greaterThanOrEqual':
      return (
        !isNaN(numValue) &&
        !isNaN(numConditionValue) &&
        numValue >= numConditionValue
      );
    case 'lessThanOrEqual':
      return (
        !isNaN(numValue) &&
        !isNaN(numConditionValue) &&
        numValue <= numConditionValue
      );
    case 'equal':
      if (typeof value === 'string' && typeof conditionValue === 'string') {
        return value === conditionValue;
      }
      return (
        !isNaN(numValue) &&
        !isNaN(numConditionValue) &&
        numValue === numConditionValue
      );
    case 'notEqual':
      if (typeof value === 'string' && typeof conditionValue === 'string') {
        return value !== conditionValue;
      }
      return (
        isNaN(numValue) ||
        isNaN(numConditionValue) ||
        numValue !== numConditionValue
      );
    case 'empty':
      return (
        value === null ||
        typeof value === 'undefined' ||
        value === '' ||
        (typeof value === 'number' && isNaN(value))
      );
    case 'notEmpty':
      return (
        value !== null &&
        typeof value !== 'undefined' &&
        value !== '' &&
        !(typeof value === 'number' && isNaN(value))
      );
    case 'contains':
      if (typeof value === 'string' && typeof conditionValue === 'string') {
        return value.toLowerCase().includes(conditionValue.toLowerCase());
      }
      return false;
    case 'notContains':
      if (typeof value === 'string' && typeof conditionValue === 'string') {
        return !value.toLowerCase().includes(conditionValue.toLowerCase());
      }
      return true;
    default:
      return false;
  }
}

// Apply conditional formatting rules to a value
function getConditionalFormattingStyle(value, conditionalFormatting) {
  if (!conditionalFormatting || !Array.isArray(conditionalFormatting.rules)) {
    return {};
  }

  // Evaluate rules in order, return first matching rule's style
  for (const rule of conditionalFormatting.rules) {
    if (evaluateCondition(value, rule.condition)) {
      // Return a copy of the style object to avoid mutations
      return rule.style ? Object.assign({}, rule.style) : {};
    }
  }

  return {};
}

// Merge styles, with conditional formatting taking precedence
function mergeStyles(...styles) {
  return Object.assign({}, ...styles.filter(s => s && typeof s === 'object'));
}

// Helper function to check if a string contains special characters (like -, /, etc.)
// This prevents formatting of date strings or formatted strings
// Only pure numeric strings (with optional decimal point and minus sign) should be formatted
function containsSpecialCharacters(str) {
  if (typeof str !== 'string') {
    return false;
  }
  const trimmed = str.trim();
  // Check if string contains any special characters that indicate it's not a raw number
  // Allow: digits, decimal point, minus sign at start, plus sign at start, spaces
  // Disallow: hyphens in middle, slashes, and other special characters
  const pureNumericPattern = /^-?\d*\.?\d+$/;
  return !pureNumericPattern.test(trimmed);
}

// Helper function to check if an aggregation should skip formatting
// Aggregations like Count, First, Last should not be formatted
// Aggregations like Sum, Average should be formatted
function shouldSkipFormattingForAggregation(aggregatorName) {
  if (!aggregatorName) {
    return false;
  }

  const name = aggregatorName.toLowerCase();
  // Skip formatting for these aggregation types
  const skipFormattingAggregations = [
    'count',
    'count unique values',
    'list unique values',
    'first',
    'last',
    'minimum',
    'maximum',
  ];
  return skipFormattingAggregations.includes(name);
}

// Apply cell formatting rules to a value
function applyCellFormatting(
  value,
  cellFormatting,
  defaultFormatter,
  aggregatorName = null
) {
  // Don't format if aggregation type should skip formatting (e.g., Count, First, Last)
  // Only use defaultFormatter if value is numeric, otherwise return as-is
  const isNumeric =
    (typeof value === 'number' && !isNaN(value) && isFinite(value)) ||
    (typeof value === 'string' &&
      value.trim() !== '' &&
      !containsSpecialCharacters(value) &&
      !isNaN(parseFloat(value)) &&
      isFinite(parseFloat(value)));
  if (shouldSkipFormattingForAggregation(aggregatorName)) {
    if (isNumeric && defaultFormatter) {
      return defaultFormatter(value);
    }
    // Return raw value for non-numeric values (dates, strings, etc.)
    return value;
  }

  // If no cellFormatting rules, always use default formatter to return to original format
  // This ensures values return to their original format when cellFormatting is cleared
  // Check for all possible cases: null, undefined, empty object, empty rules array
  const hasFormattingRules =
    cellFormatting &&
    typeof cellFormatting === 'object' &&
    Array.isArray(cellFormatting.rules) &&
    cellFormatting.rules.length > 0 &&
    cellFormatting.rules.some(rule => rule && rule.format);

  if (!hasFormattingRules) {
    // When cellFormatting rules are cleared, return the raw value (not formatted)
    // This ensures all cells (regular, Totals, Aggregation) return to their original unformatted state
    // Return the raw numeric value for numbers, or the value as-is for other types
    if (isNumeric) {
      // Return raw numeric value without any formatting
      if (typeof value === 'number') {
        return value;
      }
      // For string numbers, return the parsed numeric value
      return parseFloat(value);
    }
    // For non-numeric values (dates, strings, etc.), return as-is
    return value;
  }

  // Don't format if it contains special characters (dates, formatted strings, etc.)
  // Only check this when cellFormatting rules exist
  if (containsSpecialCharacters(value)) {
    return defaultFormatter ? defaultFormatter(value) : String(value);
  }

  // Check if value is a number - only apply custom formatting to raw numbers
  // Handle both number type and string numbers (e.g., "123.45")
  // Exclude strings with special characters from formatting
  let numericValue = value;

  // Convert string numbers to actual numbers for formatting
  if (isNumeric && typeof value === 'string') {
    numericValue = parseFloat(value);
  }

  // Use the first rule (all rules apply to all values)
  const matchingRule = cellFormatting.rules[0];

  // If we found a matching rule and value is numeric, apply its formatting
  if (matchingRule && matchingRule.format && isNumeric) {
    const format = matchingRule.format;
    const formatter = numberFormat({
      digitsAfterDecimal: 'decimalPlaces' in format ? format.decimalPlaces : 2,
      thousandsSep: 'thousandsSep' in format ? format.thousandsSep : ',',
      decimalSep: 'decimalSep' in format ? format.decimalSep : '.',
      prefix: 'prefix' in format ? format.prefix : '',
      suffix: 'suffix' in format ? format.suffix : '',
    });
    return formatter(numericValue);
  }

  // Not numeric or no matching rule, use default formatter
  return defaultFormatter ? defaultFormatter(value) : String(value);
}

function makeRenderer(opts = {}) {
  class TableRenderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols;
      const rowAttrs = pivotData.props.rows;
      const aggregations = pivotData.getAggregations();
      const primaryAggregation = pivotData.getPrimaryAggregation();
      const hasMultipleAggregators = aggregations.length > 1;
      const rowAttrsToRender = hasMultipleAggregators
        ? rowAttrs.concat(['Values'])
        : rowAttrs;
      const rowKeys = pivotData.getRowKeys();
      const baseRowKeys =
        hasMultipleAggregators && rowKeys.length === 0 ? [[]] : rowKeys;
      const renderedRows = hasMultipleAggregators
        ? baseRowKeys.reduce((acc, rowKey) => {
            aggregations.forEach(agg => {
              acc.push({
                displayKey: rowKey.concat([agg.label || agg.aggregatorName]),
                actualKey: rowKey,
                aggregationKey: agg.key,
              });
            });
            return acc;
          }, [])
        : baseRowKeys.map(rowKey => ({
            displayKey: rowKey,
            actualKey: rowKey,
            aggregationKey: primaryAggregation.key,
          }));
      const rowKeyValues = renderedRows.map(r => r.displayKey);
      const colKeys = pivotData.getColKeys();

      let valueCellColors = () => {};
      let rowTotalColors = () => {};
      let colTotalColors = () => {};
      if (opts.heatmapMode && !hasMultipleAggregators) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        const rowTotalValues = colKeys.map(x =>
          pivotData.getAggregator([], x, primaryAggregation.key).value()
        );
        rowTotalColors = colorScaleGenerator(rowTotalValues);
        const colTotalValues = rowKeys.map(x =>
          pivotData.getAggregator(x, [], primaryAggregation.key).value()
        );
        colTotalColors = colorScaleGenerator(colTotalValues);

        if (opts.heatmapMode === 'full') {
          const allValues = [];
          rowKeys.map(r =>
            colKeys.map(c =>
              allValues.push(
                pivotData.getAggregator(r, c, primaryAggregation.key).value()
              )
            )
          );
          const colorScale = colorScaleGenerator(allValues);
          valueCellColors = (r, c, v) => colorScale(v);
        } else if (opts.heatmapMode === 'row') {
          const rowColorScales = {};
          rowKeys.map(r => {
            const rowValues = colKeys.map(x =>
              pivotData.getAggregator(r, x, primaryAggregation.key).value()
            );
            rowColorScales[r] = colorScaleGenerator(rowValues);
          });
          valueCellColors = (r, c, v) => rowColorScales[r](v);
        } else if (opts.heatmapMode === 'col') {
          const colColorScales = {};
          colKeys.map(c => {
            const colValues = rowKeys.map(x =>
              pivotData.getAggregator(x, c, primaryAggregation.key).value()
            );
            colColorScales[c] = colorScaleGenerator(colValues);
          });
          valueCellColors = (r, c, v) => colColorScales[c](v);
        }
      }

      // Get conditional formatting from tableOptions
      const conditionalFormatting =
        this.props.tableOptions && this.props.tableOptions.conditionalFormatting
          ? this.props.tableOptions.conditionalFormatting
          : null;

      // Get cell formatting from tableOptions
      const cellFormatting =
        this.props.tableOptions && this.props.tableOptions.cellFormatting
          ? this.props.tableOptions.cellFormatting
          : null;

      // Create lookup map from aggregationKey to aggregatorName
      const aggregationNameLookup = {};
      aggregations.forEach(agg => {
        aggregationNameLookup[agg.key] = agg.aggregatorName;
      });

      // Helper function to get cell style with conditional formatting
      const getCellStyle = (value, heatmapStyle = {}) => {
        const conditionalStyle = getConditionalFormattingStyle(
          value,
          conditionalFormatting
        );
        return mergeStyles(heatmapStyle, conditionalStyle);
      };

      // Helper function to format cell value with cell formatting rules
      const formatCellValue = (value, aggregator, aggregationKey) => {
        const aggregatorName = aggregationKey
          ? aggregationNameLookup[aggregationKey]
          : null;

        return applyCellFormatting(
          value,
          cellFormatting,
          aggregator.format.bind(aggregator),
          aggregatorName
        );
      };

      // Helper function to format label text if it's numeric
      // Used for both row and column labels
      const formatLabel = txt => {
        // Check if txt is numeric (number or numeric string)
        // Also exclude 'null' string which is used for missing values
        if (txt === 'null' || txt === null || typeof txt === 'undefined') {
          return txt;
        }

        // Don't format if it contains special characters (dates, formatted strings, etc.)
        if (containsSpecialCharacters(txt)) {
          return txt;
        }

        // Check if txt is numeric (number or numeric string)
        // A string is numeric if it can be parsed as a finite number
        // Exclude strings with special characters from formatting
        let isNumeric = false;
        let numericValue = null;

        if (typeof txt === 'number') {
          isNumeric = !isNaN(txt) && isFinite(txt);
          if (isNumeric) {
            numericValue = txt;
          }
        } else if (
          typeof txt === 'string' &&
          txt.trim() !== '' &&
          txt !== 'null' &&
          !containsSpecialCharacters(txt)
        ) {
          const parsed = parseFloat(txt.trim());
          isNumeric = !isNaN(parsed) && isFinite(parsed);
          if (isNumeric) {
            numericValue = parsed;
          }
        }

        if (
          isNumeric &&
          numericValue !== null &&
          cellFormatting &&
          Array.isArray(cellFormatting.rules) &&
          cellFormatting.rules.length > 0
        ) {
          const matchingRule = cellFormatting.rules[0];
          if (matchingRule && matchingRule.format) {
            const format = matchingRule.format;
            const formatter = numberFormat({
              digitsAfterDecimal:
                'decimalPlaces' in format ? format.decimalPlaces : 2,
              thousandsSep:
                'thousandsSep' in format ? format.thousandsSep : ',',
              decimalSep: 'decimalSep' in format ? format.decimalSep : '.',
              prefix: 'prefix' in format ? format.prefix : '',
              suffix: 'suffix' in format ? format.suffix : '',
            });
            return formatter(numericValue);
          }
        }

        // Not numeric or no formatting rules, return as-is
        return txt;
      };

      // Helper function to format row label text if it's numeric
      // Only formats if it's a numeric value, not aggregation labels
      const formatRowLabel = (
        txt,
        index,
        isLastElement,
        hasMultipleAggregators,
        rowAttrsLength
      ) => {
        // Don't format the last element if it's an aggregation label (when multiple aggregators)
        // The last element is an aggregation label only if:
        // 1. There are multiple aggregators
        // 2. AND it's beyond the row attributes (index >= rowAttrsLength)
        if (
          hasMultipleAggregators &&
          isLastElement &&
          index >= rowAttrsLength
        ) {
          return txt;
        }

        return formatLabel(txt);
      };

      const getClickHandler =
        this.props.tableOptions && this.props.tableOptions.clickCallback
          ? (value, rowValues, colValues) => {
              const filters = {};
              for (const i of Object.keys(colAttrs || {})) {
                const attr = colAttrs[i];
                if (colValues[i] !== null) {
                  filters[attr] = colValues[i];
                }
              }
              for (const i of Object.keys(rowAttrs || {})) {
                const attr = rowAttrs[i];
                if (rowValues[i] !== null) {
                  filters[attr] = rowValues[i];
                }
              }
              return e =>
                this.props.tableOptions.clickCallback(
                  e,
                  value,
                  filters,
                  pivotData
                );
            }
          : null;

      const handleColSort = (attr, e) => {
        e.stopPropagation();
        if (this.props.onColSort) {
          const currentSort = this.props.colSorts && this.props.colSorts[attr];
          let nextSort = 'ASC';
          if (currentSort === 'ASC') {
            nextSort = 'DESC';
          } else if (currentSort === 'DESC') {
            nextSort = null;
          }
          this.props.onColSort(attr, nextSort);
        }
      };

      const handleRowSort = (attr, e) => {
        e.stopPropagation();
        if (this.props.onRowSort) {
          const currentSort = this.props.rowSorts && this.props.rowSorts[attr];
          let nextSort = 'ASC';
          if (currentSort === 'ASC') {
            nextSort = 'DESC';
          } else if (currentSort === 'DESC') {
            nextSort = null;
          }
          this.props.onRowSort(attr, nextSort);
        }
      };

      const getSortButton = (attr, isCol) => {
        const currentSort = isCol
          ? this.props.colSorts && this.props.colSorts[attr]
          : this.props.rowSorts && this.props.rowSorts[attr];
        const handleSort = isCol ? handleColSort : handleRowSort;
        let sortIcon = '';
        if (currentSort !== null) {
          if (isCol) {
            sortIcon = this.props.colSortIcons[currentSort] || this.props.colSortIcons['DEFAULT'];
          } else {
            sortIcon = this.props.rowSortIcons[currentSort] || this.props.rowSortIcons['DEFAULT'];
          }
        }
        return (
          <button
            type="button"
            className="pvtSortButton"
            onClick={e => handleSort(attr, e)}
            title={
              currentSort === 'ASC'
                ? 'Sort Descending'
                : currentSort === 'DESC'
                ? 'Clear Sort'
                : 'Sort Ascending'
            }
          >
            {sortIcon}
          </button>
        );
      };

      return (
        <table className="pvtTable">
          <thead>
            {colAttrs.map(function(c, j) {
              return (
                <tr key={`colAttr${j}`}>
                  {j === 0 && rowAttrsToRender.length !== 0 && (
                    <th
                      colSpan={rowAttrsToRender.length}
                      rowSpan={colAttrs.length}
                    />
                  )}
                  <th className="pvtAxisLabel">
                    {c}
                    {getSortButton(c, true)}
                  </th>
                  {colKeys.map(function(colKey, i) {
                    const x = spanSize(colKeys, i, j);
                    if (x === -1) {
                      return null;
                    }
                    const formattedColLabel = formatLabel(colKey[j]);
                    return (
                      <th
                        className="pvtColLabel"
                        key={`colKey${i}`}
                        colSpan={x}
                        rowSpan={
                          j === colAttrs.length - 1 &&
                          rowAttrsToRender.length !== 0
                            ? 2
                            : 1
                        }
                      >
                        {formattedColLabel}
                      </th>
                    );
                  })}

                  {j === 0 && (
                    <th
                      className="pvtTotalLabel"
                      rowSpan={
                        colAttrs.length +
                        (rowAttrsToRender.length === 0 ? 0 : 1)
                      }
                    >
                      Totals
                    </th>
                  )}
                </tr>
              );
            })}

            {rowAttrsToRender.length !== 0 && (
              <tr>
                {rowAttrsToRender.map((r, i) => {
                  const isRowAttr = i < rowAttrs.length;
                  const attr = isRowAttr ? rowAttrs[i] : null;
                  return (
                    <th className="pvtAxisLabel" key={`rowAttr${i}`}>
                      {r}
                      {isRowAttr && attr && getSortButton(attr, false)}
                    </th>
                  );
                })}
                <th className="pvtTotalLabel">
                  {colAttrs.length === 0 ? 'Totals' : null}
                </th>
              </tr>
            )}
          </thead>

          <tbody>
            {renderedRows.map(function(rowMeta, i) {
              const totalAggregator = pivotData.getAggregator(
                rowMeta.actualKey,
                [],
                rowMeta.aggregationKey
              );
              const displayKey = rowMeta.displayKey;
              return (
                <tr key={`rowKeyRow${i}`}>
                  {displayKey.map(function(txt, j) {
                    const x = spanSize(rowKeyValues, i, j);
                    if (x === -1) {
                      return null;
                    }
                    const isLastElement = j === displayKey.length - 1;
                    const formattedTxt = formatRowLabel(
                      txt,
                      j,
                      isLastElement,
                      hasMultipleAggregators,
                      rowAttrs.length
                    );
                    return (
                      <th
                        key={`rowKeyLabel${i}-${j}`}
                        className="pvtRowLabel"
                        rowSpan={x}
                        colSpan={
                          j === rowAttrsToRender.length - 1 &&
                          colAttrs.length !== 0
                            ? 2
                            : 1
                        }
                      >
                        {formattedTxt}
                      </th>
                    );
                  })}
                  {colKeys.map(function(colKey, j) {
                    const aggregator = pivotData.getAggregator(
                      rowMeta.actualKey,
                      colKey,
                      rowMeta.aggregationKey
                    );
                    const value = aggregator.value();
                    const heatmapStyle =
                      valueCellColors(rowMeta.actualKey, colKey, value) || {};
                    return (
                      <td
                        className="pvtVal"
                        key={`pvtVal${i}-${j}`}
                        onClick={
                          getClickHandler &&
                          getClickHandler(value, rowMeta.actualKey, colKey)
                        }
                        style={getCellStyle(value, heatmapStyle)}
                      >
                        {formatCellValue(
                          value,
                          aggregator,
                          rowMeta.aggregationKey
                        )}
                      </td>
                    );
                  })}
                  <td
                    className="pvtTotal"
                    onClick={
                      getClickHandler &&
                      getClickHandler(
                        totalAggregator.value(),
                        rowMeta.actualKey,
                        [null]
                      )
                    }
                    style={getCellStyle(
                      totalAggregator.value(),
                      colTotalColors(totalAggregator.value()) || {}
                    )}
                  >
                    {formatCellValue(
                      totalAggregator.value(),
                      totalAggregator,
                      rowMeta.aggregationKey
                    )}
                  </td>
                </tr>
              );
            })}

            {(hasMultipleAggregators ? aggregations : [primaryAggregation]).map(
              function(agg) {
                const grandTotalAggregator = pivotData.getAggregator(
                  [],
                  [],
                  agg.key
                );
                const totalLabel = hasMultipleAggregators
                  ? `Totals – ${agg.label || agg.aggregatorName}`
                  : 'Totals';
                return (
                  <tr key={`totalRow-${agg.key}`}>
                    <th
                      className="pvtTotalLabel"
                      colSpan={
                        rowAttrsToRender.length +
                        (colAttrs.length === 0 ? 0 : 1)
                      }
                    >
                      {totalLabel}
                    </th>

                    {colKeys.map(function(colKey, i) {
                      const totalAggregator = pivotData.getAggregator(
                        [],
                        colKey,
                        agg.key
                      );
                      const totalValue = totalAggregator.value();
                      return (
                        <td
                          className="pvtTotal"
                          key={`total${agg.key}-${i}`}
                          onClick={
                            getClickHandler &&
                            getClickHandler(totalValue, [null], colKey)
                          }
                          style={getCellStyle(
                            totalValue,
                            rowTotalColors(totalValue) || {}
                          )}
                        >
                          {formatCellValue(
                            totalValue,
                            totalAggregator,
                            agg.key
                          )}
                        </td>
                      );
                    })}

                    <td
                      onClick={
                        getClickHandler &&
                        getClickHandler(
                          grandTotalAggregator.value(),
                          [null],
                          [null]
                        )
                      }
                      className="pvtGrandTotal"
                      style={getCellStyle(grandTotalAggregator.value(), {})}
                    >
                      {formatCellValue(
                        grandTotalAggregator.value(),
                        grandTotalAggregator,
                        agg.key
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      );
    }
  }

  TableRenderer.defaultProps = PivotData.defaultProps;
  TableRenderer.propTypes = PivotData.propTypes;
  TableRenderer.defaultProps.tableColorScaleGenerator = redColorScaleGenerator;
  TableRenderer.defaultProps.tableOptions = {};
  TableRenderer.defaultProps.colSorts = {};
  TableRenderer.defaultProps.rowSorts = {};
  TableRenderer.propTypes.tableColorScaleGenerator = PropTypes.func;
  TableRenderer.propTypes.tableOptions = PropTypes.object;
  TableRenderer.propTypes.colSorts = PropTypes.objectOf(
    PropTypes.oneOf(['ASC', 'DESC'])
  );
  TableRenderer.propTypes.rowSorts = PropTypes.objectOf(
    PropTypes.oneOf(['ASC', 'DESC'])
  );
  TableRenderer.propTypes.onColSort = PropTypes.func;
  TableRenderer.propTypes.onRowSort = PropTypes.func;
  TableRenderer.defaultProps.colSortIcons = {
    ASC: '→',
    DESC: '←',
    DEFAULT: '↔',
  };
  TableRenderer.defaultProps.rowSortIcons = {
    ASC: '↑',
    DESC: '↓',
    DEFAULT: '⇅',
  };
  TableRenderer.propTypes.colSortIcons = PropTypes.shape({
    ASC: PropTypes.node,
    DESC: PropTypes.node,
    DEFAULT: PropTypes.node,
  });
  TableRenderer.propTypes.rowSortIcons = PropTypes.shape({
    ASC: PropTypes.node,
    DESC: PropTypes.node,
    DEFAULT: PropTypes.node,
  });
  return TableRenderer;
}

class TSVExportRenderer extends React.PureComponent {
  render() {
    const pivotData = new PivotData(this.props);
    const rowAttrs = pivotData.props.rows;
    const aggregations = pivotData.getAggregations();
    const hasMultipleAggregators = aggregations.length > 1;
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();
    const safeRowKeys = rowKeys.length === 0 ? [[]] : rowKeys;
    const safeColKeys = colKeys.length === 0 ? [[]] : colKeys;

    const rowEntries = hasMultipleAggregators
      ? safeRowKeys.reduce((acc, rowKey) => {
          aggregations.forEach(agg => {
            acc.push({rowKey, aggregationKey: agg.key, label: agg.label});
          });
          return acc;
        }, [])
      : safeRowKeys.map(rowKey => ({
          rowKey,
          aggregationKey: aggregations[0].key,
          label: aggregations[0].label || aggregations[0].aggregatorName,
        }));

    const headerRow = rowAttrs.slice();
    if (hasMultipleAggregators) {
      headerRow.push('Values');
    }
    if (safeColKeys.length === 1 && safeColKeys[0].length === 0) {
      headerRow.push(
        hasMultipleAggregators
          ? 'Value'
          : aggregations[0].label || aggregations[0].aggregatorName
      );
    } else {
      safeColKeys.map(c => headerRow.push(c.join('-')));
    }

    const result = rowEntries.map(entry => {
      const row = entry.rowKey.map(x => x);
      if (hasMultipleAggregators) {
        row.push(entry.label || '');
      }
      safeColKeys.map(colKey => {
        const v = pivotData
          .getAggregator(entry.rowKey, colKey, entry.aggregationKey)
          .value();
        row.push(v ? v : '');
      });
      return row;
    });

    result.unshift(headerRow);

    return (
      <textarea
        value={result.map(r => r.join('\t')).join('\n')}
        style={{width: window.innerWidth / 2, height: window.innerHeight / 2}}
        readOnly={true}
      />
    );
  }
}

TSVExportRenderer.defaultProps = PivotData.defaultProps;
TSVExportRenderer.propTypes = PivotData.propTypes;

export default {
  Table: makeRenderer(),
  'Table Heatmap': makeRenderer({heatmapMode: 'full'}),
  'Table Col Heatmap': makeRenderer({heatmapMode: 'col'}),
  'Table Row Heatmap': makeRenderer({heatmapMode: 'row'}),
  'Exportable TSV': TSVExportRenderer,
};
