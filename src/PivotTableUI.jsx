import React from 'react';
import PropTypes from 'prop-types';
import update from 'immutability-helper';
import { PivotData, sortAs, getSort } from './Utilities';
import PivotTable from './PivotTable';
import Sortable from 'react-sortablejs';
import Draggable from 'react-draggable';

const AGG_KEY_RADIX = 36;
const AGG_KEY_OFFSET = 2;
const AGG_KEY_LENGTH = 7;

/* eslint-disable react/prop-types */
// eslint can't see inherited propTypes!

export class DraggableAttribute extends React.Component {
  constructor(props) {
    super(props);
    this.state = { open: false, filterText: '' };
  }

  toggleValue(value) {
    if (value in this.props.valueFilter) {
      this.props.removeValuesFromFilter(this.props.name, [value]);
    } else {
      this.props.addValuesToFilter(this.props.name, [value]);
    }
  }

  matchesFilter(x) {
    return x
      .toLowerCase()
      .trim()
      .includes(this.state.filterText.toLowerCase().trim());
  }

  selectOnly(e, value) {
    e.stopPropagation();
    this.props.setValuesInFilter(
      this.props.name,
      Object.keys(this.props.attrValues).filter(y => y !== value)
    );
  }

  getFilterBox() {
    const showMenu =
      Object.keys(this.props.attrValues).length < this.props.menuLimit;

    const values = Object.keys(this.props.attrValues);
    const shown = values
      .filter(this.matchesFilter.bind(this))
      .sort(this.props.sorter);

    return (
      <Draggable handle=".pvtDragHandle">
        <div
          className="pvtFilterBox"
          style={{
            display: 'block',
            cursor: 'initial',
            zIndex: this.props.zIndex,
          }}
          onClick={() => this.props.moveFilterBoxToTop(this.props.name)}
        >
          <a onClick={() => this.setState({ open: false })} className="pvtCloseX">
            ×
          </a>
          <span className="pvtDragHandle">☰</span>
          <h4>{this.props.name}</h4>

          {showMenu || <p>(too many values to show)</p>}

          {showMenu && (
            <p>
              <input
                type="text"
                placeholder="Filter values"
                className="pvtSearch"
                value={this.state.filterText}
                onChange={e =>
                  this.setState({
                    filterText: e.target.value,
                  })
                }
              />
              <br />
              <a
                role="button"
                className="pvtButton"
                onClick={() =>
                  this.props.removeValuesFromFilter(
                    this.props.name,
                    Object.keys(this.props.attrValues).filter(
                      this.matchesFilter.bind(this)
                    )
                  )
                }
              >
                Select {values.length === shown.length ? 'All' : shown.length}
              </a>{' '}
              <a
                role="button"
                className="pvtButton"
                onClick={() =>
                  this.props.addValuesToFilter(
                    this.props.name,
                    Object.keys(this.props.attrValues).filter(
                      this.matchesFilter.bind(this)
                    )
                  )
                }
              >
                Deselect {values.length === shown.length ? 'All' : shown.length}
              </a>
            </p>
          )}

          {showMenu && (
            <div className="pvtCheckContainer">
              {shown.map(x => (
                <p
                  key={x}
                  onClick={() => this.toggleValue(x)}
                  className={x in this.props.valueFilter ? '' : 'selected'}
                >
                  <a className="pvtOnly" onClick={e => this.selectOnly(e, x)}>
                    only
                  </a>
                  <a className="pvtOnlySpacer">&nbsp;</a>

                  {x === '' ? <em>null</em> : x}
                </p>
              ))}
            </div>
          )}
        </div>
      </Draggable>
    );
  }

  toggleFilterBox() {
    this.setState({ open: !this.state.open });
    this.props.moveFilterBoxToTop(this.props.name);
  }

  render() {
    const filtered =
      Object.keys(this.props.valueFilter).length !== 0
        ? 'pvtFilteredAttribute'
        : '';
    return (
      <li data-id={this.props.name}>
        <span className={'pvtAttr ' + filtered}>
          {this.props.name}
          <span
            className="pvtTriangle"
            onClick={this.toggleFilterBox.bind(this)}
          >
            {' '}
            ▾
          </span>
        </span>

        {this.state.open ? this.getFilterBox() : null}
      </li>
    );
  }
}

DraggableAttribute.defaultProps = {
  valueFilter: {},
};

DraggableAttribute.propTypes = {
  name: PropTypes.string.isRequired,
  addValuesToFilter: PropTypes.func.isRequired,
  removeValuesFromFilter: PropTypes.func.isRequired,
  attrValues: PropTypes.objectOf(PropTypes.number).isRequired,
  valueFilter: PropTypes.objectOf(PropTypes.bool),
  moveFilterBoxToTop: PropTypes.func.isRequired,
  sorter: PropTypes.func.isRequired,
  menuLimit: PropTypes.number,
  zIndex: PropTypes.number,
};

export class Dropdown extends React.PureComponent {
  render() {
    return (
      <div className="pvtDropdown" style={{ zIndex: this.props.zIndex }}>
        <div
          onClick={e => {
            e.stopPropagation();
            this.props.toggle();
          }}
          className={
            'pvtDropdownValue pvtDropdownCurrent ' +
            (this.props.open ? 'pvtDropdownCurrentOpen' : '')
          }
          role="button"
        >
          <div className="pvtDropdownIcon">{this.props.open ? '×' : '▾'}</div>
          {this.props.current || <span>&nbsp;</span>}
        </div>

        {this.props.open && (
          <div className="pvtDropdownMenu">
            {this.props.values.map(r => (
              <div
                key={r}
                role="button"
                onClick={e => {
                  e.stopPropagation();
                  if (this.props.current === r) {
                    this.props.toggle();
                  } else {
                    this.props.setValue(r);
                  }
                }}
                className={
                  'pvtDropdownValue ' +
                  (r === this.props.current ? 'pvtDropdownActiveValue' : '')
                }
              >
                {r}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

export class ConditionalFormattingUI extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
  }

  getConditionalFormatting() {
    const tableOptions = this.props.tableOptions || {};
    return tableOptions.conditionalFormatting
      ? tableOptions.conditionalFormatting
      : { rules: [] };
  }

  updateConditionalFormatting(conditionalFormatting) {
    const currentTableOptions = this.props.tableOptions || {};
    const tableOptions = Object.assign({}, currentTableOptions, {
      conditionalFormatting,
    });
    this.props.onChange({
      tableOptions: { $set: tableOptions },
    });
  }

  addRule() {
    const cf = this.getConditionalFormatting();
    const newRule = {
      condition: {
        type: 'greaterThan',
        value: 0,
      },
      style: {
        backgroundColor: '#FFFFE0',
      },
    };
    this.updateConditionalFormatting({
      rules: cf.rules.slice().concat([newRule]),
    });
  }

  removeRule(index) {
    const cf = this.getConditionalFormatting();
    const newRules = cf.rules.filter((_, i) => i !== index);
    this.updateConditionalFormatting({
      rules: newRules,
    });
  }

  updateRule(index, field, value) {
    const cf = this.getConditionalFormatting();
    const newRules = cf.rules.slice();
    if (field.startsWith('condition.')) {
      const conditionField = field.replace('condition.', '');
      const newCondition = Object.assign({}, newRules[index].condition);
      if (value === null) {
        delete newCondition[conditionField];
      } else {
        newCondition[conditionField] = value;
      }
      newRules[index] = Object.assign({}, newRules[index], {
        condition: newCondition,
      });
    } else if (field.startsWith('style.')) {
      const styleField = field.replace('style.', '');
      const newStyle = Object.assign({}, newRules[index].style || {});
      if (value === null || value === '') {
        delete newStyle[styleField];
      } else {
        newStyle[styleField] = value;
      }
      newRules[index] = Object.assign({}, newRules[index], {
        style: newStyle,
      });
    }
    this.updateConditionalFormatting({
      rules: newRules,
    });
  }

  toggle() {
    this.setState({ open: !this.state.open });
    if (this.props.moveToTop) {
      this.props.moveToTop();
    }
  }

  render() {
    const cf = this.getConditionalFormatting();
    const conditionTypes = [
      { value: 'greaterThan', label: 'Greater Than' },
      { value: 'lessThan', label: 'Less Than' },
      { value: 'greaterThanOrEqual', label: 'Greater Than Or Equal' },
      { value: 'lessThanOrEqual', label: 'Less Than Or Equal' },
      { value: 'equal', label: 'Equal' },
      { value: 'notEqual', label: 'Not Equal' },
      { value: 'empty', label: 'Empty' },
      { value: 'notEmpty', label: 'Not Empty' },
      { value: 'contains', label: 'Contains' },
      { value: 'notContains', label: 'Not Contains' },
    ];

    const needsValue = (type) => {
      return !['empty', 'notEmpty'].includes(type);
    };

    return (
      <div>
        <button
          type="button"
          className="pvtButton"
          onClick={e => {
            e.stopPropagation();
            this.toggle();
          }}
          style={{ marginTop: '5px' }}
        >
          {this.state.open ? '▼' : '▶'} Conditional Formatting
        </button>

        {this.state.open && (
          <div
            className="pvtFilterBox"
            style={{
              display: 'block',
              cursor: 'initial',
              zIndex: this.props.zIndex,
              marginTop: '5px',
              minWidth: '400px',
              position: 'relative',
            }}
            onClick={() => this.props.moveToTop && this.props.moveToTop()}
          >
            <a
              onClick={() => this.setState({ open: false })}
              className="pvtCloseX"
            >
              ×
            </a>
            <h4>Conditional Formatting Rules</h4>

            {cf.rules.length === 0 && (
              <p style={{ fontStyle: 'italic', color: '#666' }}>
                No rules defined. Add a rule to format cells based on conditions.
              </p>
            )}

            {cf.rules.map((rule, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #c8d4e3',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>Rule {index + 1}</strong>
                  <button
                    type="button"
                    className="pvtButton"
                    onClick={e => {
                      e.stopPropagation();
                      this.removeRule(index);
                    }}
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                  >
                    Remove
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Condition Type:
                  </label>
                  <select
                    value={rule.condition.type || 'greaterThan'}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'condition.type', e.target.value);
                      // Reset value if condition type doesn't need it
                      if (!needsValue(e.target.value)) {
                        this.updateRule(index, 'condition.value', null);
                      }
                    }}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    {conditionTypes.map(ct => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                {needsValue(rule.condition.type) && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                      Condition Value:
                    </label>
                    <input
                      type="text"
                      value={typeof rule.condition.value !== 'undefined' && rule.condition.value !== null ? rule.condition.value : ''}
                      onChange={e => {
                        e.stopPropagation();
                        const val = e.target.value;
                        // Try to parse as number, otherwise use as string
                        const numVal = val === '' ? null : (isNaN(val) ? val : parseFloat(val));
                        this.updateRule(index, 'condition.value', numVal);
                      }}
                      placeholder="Enter value"
                      style={{ width: '100%', padding: '4px' }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Background Color:
                  </label>
                  <input
                    type="color"
                    value={rule.style && rule.style.backgroundColor ? rule.style.backgroundColor : '#FFFFFF'}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'style.backgroundColor', e.target.value);
                    }}
                    style={{ width: '100%', padding: '2px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Text Color:
                  </label>
                  <input
                    type="color"
                    value={rule.style && rule.style.color ? rule.style.color : '#000000'}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'style.color', e.target.value);
                    }}
                    style={{ width: '100%', padding: '2px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Font Weight:
                  </label>
                  <select
                    value={rule.style && rule.style.fontWeight ? rule.style.fontWeight : ''}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'style.fontWeight', e.target.value || null);
                    }}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    <option value="">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="lighter">Lighter</option>
                  </select>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Font Style:
                  </label>
                  <select
                    value={rule.style && rule.style.fontStyle ? rule.style.fontStyle : ''}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'style.fontStyle', e.target.value || null);
                    }}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    <option value="">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="oblique">Oblique</option>
                  </select>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="pvtButton"
              onClick={e => {
                e.stopPropagation();
                this.addRule();
              }}
              style={{ width: '100%', marginTop: '10px' }}
            >
              + Add Rule
            </button>
          </div>
        )}
      </div>
    );
  }
}

ConditionalFormattingUI.propTypes = {
  tableOptions: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  moveToTop: PropTypes.func,
  zIndex: PropTypes.number,
};

ConditionalFormattingUI.defaultProps = {
  tableOptions: {},
  moveToTop: () => { },
  zIndex: 1,
};

export class CellFormattingUI extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
  }

  getCellFormatting() {
    const tableOptions = this.props.tableOptions || {};
    return tableOptions.cellFormatting
      ? tableOptions.cellFormatting
      : { rules: [] };
  }

  updateCellFormatting(cellFormatting) {
    const currentTableOptions = this.props.tableOptions || {};
    const tableOptions = Object.assign({}, currentTableOptions, {
      cellFormatting,
    });
    this.props.onChange({
      tableOptions: { $set: tableOptions },
    });
  }

  addRule() {
    const cf = this.getCellFormatting();
    const newRule = {
      format: {
        thousandsSep: ',',
        decimalSep: '.',
        decimalPlaces: 2,
        prefix: '',
        suffix: '',
      },
    };
    this.updateCellFormatting({
      rules: cf.rules.slice().concat([newRule]),
    });
  }

  removeRule(index) {
    const cf = this.getCellFormatting();
    const newRules = cf.rules.filter((_, i) => i !== index);
    this.updateCellFormatting({
      rules: newRules,
    });
  }

  updateRule(index, field, value) {
    const cf = this.getCellFormatting();
    const newRules = cf.rules.slice();
    if (field.startsWith('format.')) {
      const formatField = field.replace('format.', '');
      const newFormat = Object.assign({}, newRules[index].format || {});
      if (value === null || value === '') {
        delete newFormat[formatField];
      } else {
        newFormat[formatField] = value;
      }
      newRules[index] = Object.assign({}, newRules[index], {
        format: newFormat,
      });
    } else {
      newRules[index] = Object.assign({}, newRules[index], {
        [field]: value,
      });
    }
    this.updateCellFormatting({
      rules: newRules,
    });
  }

  toggle() {
    this.setState({ open: !this.state.open });
    if (this.props.moveToTop) {
      this.props.moveToTop();
    }
  }

  render() {
    const cf = this.getCellFormatting();

    return (
      <div>
        <button
          type="button"
          className="pvtButton"
          onClick={e => {
            e.stopPropagation();
            this.toggle();
          }}
          style={{ marginTop: '5px' }}
        >
          {this.state.open ? '▼' : '▶'} Cell Formatting
        </button>

        {this.state.open && (
          <div
            className="pvtFilterBox"
            style={{
              display: 'block',
              cursor: 'initial',
              zIndex: this.props.zIndex,
              marginTop: '5px',
              minWidth: '400px',
              position: 'relative',
            }}
            onClick={() => this.props.moveToTop && this.props.moveToTop()}
          >
            <a
              onClick={() => this.setState({ open: false })}
              className="pvtCloseX"
            >
              ×
            </a>
            <h4>Cell Formatting Rules</h4>

            {cf.rules.length === 0 && (
              <p style={{ fontStyle: 'italic', color: '#666' }}>
                No rules defined. Add a rule to format cell values.
              </p>
            )}

            {cf.rules.map((rule, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #c8d4e3',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>Rule {index + 1}</strong>
                  <button
                    type="button"
                    className="pvtButton"
                    onClick={e => {
                      e.stopPropagation();
                      this.removeRule(index);
                    }}
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                  >
                    Remove
                  </button>
                </div>


                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Thousand Separator:
                  </label>
                  <input
                    type="text"
                    value={(rule.format && 'thousandsSep' in rule.format) ? rule.format.thousandsSep : ','}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'format.thousandsSep', e.target.value);
                    }}
                    placeholder=","
                    maxLength="1"
                    style={{ width: '100%', padding: '4px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Decimal Separator:
                  </label>
                  <input
                    type="text"
                    value={(rule.format && 'decimalSep' in rule.format) ? rule.format.decimalSep : '.'}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'format.decimalSep', e.target.value);
                    }}
                    placeholder="."
                    maxLength="1"
                    style={{ width: '100%', padding: '4px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Decimal Places:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={(rule.format && 'decimalPlaces' in rule.format) ? rule.format.decimalPlaces : 2}
                    onChange={e => {
                      e.stopPropagation();
                      const val = parseInt(e.target.value, 10);
                      this.updateRule(index, 'format.decimalPlaces', isNaN(val) ? 2 : val);
                    }}
                    placeholder="2"
                    style={{ width: '100%', padding: '4px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Prefix (e.g., $, €):
                  </label>
                  <input
                    type="text"
                    value={(rule.format && 'prefix' in rule.format) ? rule.format.prefix : ''}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'format.prefix', e.target.value);
                    }}
                    placeholder=""
                    style={{ width: '100%', padding: '4px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                    Suffix (e.g., %, units):
                  </label>
                  <input
                    type="text"
                    value={(rule.format && 'suffix' in rule.format) ? rule.format.suffix : ''}
                    onChange={e => {
                      e.stopPropagation();
                      this.updateRule(index, 'format.suffix', e.target.value);
                    }}
                    placeholder=""
                    style={{ width: '100%', padding: '4px' }}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              className="pvtButton"
              onClick={e => {
                e.stopPropagation();
                this.addRule();
              }}
              style={{ width: '100%', marginTop: '10px' }}
            >
              + Add Rule
            </button>
          </div>
        )}
      </div>
    );
  }
}

CellFormattingUI.propTypes = {
  tableOptions: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  moveToTop: PropTypes.func,
  zIndex: PropTypes.number,
};

CellFormattingUI.defaultProps = {
  tableOptions: {},
  moveToTop: () => { },
  zIndex: 1,
};

class PivotTableUI extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      unusedOrder: [],
      zIndices: {},
      maxZIndex: 1000,
      openDropdown: false,
      attrValues: {},
      materializedInput: [],
    };
  }

  componentDidMount() {
    this.materializeInput(this.props.data);
  }

  componentDidUpdate() {
    this.materializeInput(this.props.data);
  }

  materializeInput(nextData) {
    if (this.state.data === nextData) {
      return;
    }
    const newState = {
      data: nextData,
      attrValues: {},
      materializedInput: [],
    };
    let recordsProcessed = 0;
    PivotData.forEachRecord(
      newState.data,
      this.props.derivedAttributes,
      function (record) {
        newState.materializedInput.push(record);
        for (const attr of Object.keys(record)) {
          if (!(attr in newState.attrValues)) {
            newState.attrValues[attr] = {};
            if (recordsProcessed > 0) {
              newState.attrValues[attr].null = recordsProcessed;
            }
          }
        }
        for (const attr in newState.attrValues) {
          const value = attr in record ? record[attr] : 'null';
          if (!(value in newState.attrValues[attr])) {
            newState.attrValues[attr][value] = 0;
          }
          newState.attrValues[attr][value]++;
        }
        recordsProcessed++;
      }
    );
    this.setState(newState);
  }

  sendPropUpdate(command) {
    this.props.onChange(update(this.props, command));
  }

  propUpdater(key) {
    return value => this.sendPropUpdate({ [key]: { $set: value } });
  }

  hasExternalAggregations() {
    return (
      Array.isArray(this.props.aggregations)
    );
  }

  getCurrentAggregations() {
    const fallbackAggregator =
      this.props.aggregatorName || Object.keys(this.props.aggregators)[0];
    const fallbackVals = Array.isArray(this.props.vals)
      ? this.props.vals.slice()
      : [];
    const aggregationsProvided = this.hasExternalAggregations();
    const defaultAggregations = [
      {
        key: 'agg-default',
        aggregatorName: fallbackAggregator,
        vals: fallbackVals,
      },
    ];
    const source = aggregationsProvided
      ? this.props.aggregations
      : defaultAggregations;
    return source.map((agg, idx) => {
      const aggregatorName = agg.aggregatorName || fallbackAggregator;
      const baseVals = Array.isArray(agg.vals)
        ? agg.vals.slice()
        : aggregationsProvided
          ? []
          : fallbackVals;
      return {
        key: agg.key || `agg-${idx}`,
        aggregatorName,
        vals: this.defaultValsForAggregator(aggregatorName, baseVals),
      };
    });
  }

  numInputsForAggregator(name) {
    if (!name || !(name in this.props.aggregators)) {
      return 0;
    }
    const instance = this.props.aggregators[name]([])();
    return instance.numInputs || 0;
  }

  getAttributeOptions() {
    return Object.keys(this.state.attrValues).filter(
      e =>
        !this.props.hiddenAttributes.includes(e) &&
        !this.props.hiddenFromAggregators.includes(e)
    );
  }

  defaultValsForAggregator(name, currentVals = []) {
    const required = this.numInputsForAggregator(name);
    if (required === 0) {
      return [];
    }
    const options = this.getAttributeOptions();
    const next = currentVals.slice(0, required);
    for (let i = 0; i < required; i++) {
      if (!next[i]) {
        next[i] = options[i % options.length] || null;
      }
    }
    return next;
  }

  generateAggregationKey() {
    const timestamp = Date.now().toString(AGG_KEY_RADIX);
    const randomPart = Math.random()
      .toString(AGG_KEY_RADIX)
      .slice(AGG_KEY_OFFSET, AGG_KEY_OFFSET + AGG_KEY_LENGTH);
    return `agg-${timestamp}-${randomPart}`;
  }

  updateAggregations(nextAggregations) {
    if (!nextAggregations.length) {
      return;
    }
    const fallbackAggregator =
      this.props.aggregatorName || Object.keys(this.props.aggregators)[0];
    const sanitized = nextAggregations.map((agg, idx) => {
      const aggregatorName = agg.aggregatorName || fallbackAggregator;
      return {
        key: agg.key || `agg-${idx}`,
        aggregatorName,
        vals: this.defaultValsForAggregator(
          aggregatorName,
          Array.isArray(agg.vals) ? agg.vals.slice() : []
        ),
      };
    });
    const primary = sanitized[0];
    const command = {
      aggregations: { $set: sanitized },
    };
    if (!this.hasExternalAggregations()) {
      command.aggregatorName = { $set: primary.aggregatorName };
      command.vals = { $set: primary.vals };
    }
    this.sendPropUpdate(command);
  }

  setAggregationAggregator(index, aggregatorName) {
    const aggregations = this.getCurrentAggregations();
    const next = Object.assign({}, aggregations[index], {
      aggregatorName,
    });
    next.vals = this.defaultValsForAggregator(aggregatorName, next.vals);
    aggregations[index] = next;
    this.updateAggregations(aggregations);
  }

  setAggregationVal(index, valIndex, value) {
    const aggregations = this.getCurrentAggregations();
    const next = Object.assign({}, aggregations[index]);
    const vals = Array.isArray(next.vals) ? next.vals.slice() : [];
    vals[valIndex] = value;
    next.vals = vals;
    aggregations[index] = next;
    this.updateAggregations(aggregations);
  }

  addAggregationRow() {
    const aggregations = this.getCurrentAggregations();
    const defaultAggregator =
      this.props.aggregatorName || Object.keys(this.props.aggregators)[0];
    const key = this.generateAggregationKey();
    aggregations.push({
      key,
      aggregatorName: defaultAggregator,
      vals: this.defaultValsForAggregator(defaultAggregator),
    });
    this.updateAggregations(aggregations);
  }

  removeAggregationRow(index) {
    const aggregations = this.getCurrentAggregations();
    if (aggregations.length === 1) {
      return;
    }
    aggregations.splice(index, 1);
    this.updateAggregations(aggregations);
  }

  setValuesInFilter(attribute, values) {
    this.sendPropUpdate({
      valueFilter: {
        [attribute]: {
          $set: values.reduce((r, v) => {
            r[v] = true;
            return r;
          }, {}),
        },
      },
    });
  }

  addValuesToFilter(attribute, values) {
    if (attribute in this.props.valueFilter) {
      this.sendPropUpdate({
        valueFilter: {
          [attribute]: values.reduce((r, v) => {
            r[v] = { $set: true };
            return r;
          }, {}),
        },
      });
    } else {
      this.setValuesInFilter(attribute, values);
    }
  }

  removeValuesFromFilter(attribute, values) {
    this.sendPropUpdate({
      valueFilter: { [attribute]: { $unset: values } },
    });
  }

  moveFilterBoxToTop(attribute) {
    this.setState(
      update(this.state, {
        maxZIndex: { $set: this.state.maxZIndex + 1 },
        zIndices: { [attribute]: { $set: this.state.maxZIndex + 1 } },
      })
    );
  }

  handleColSort(attr, sortDir) {
    // Only allow sorting 1 column at a time - clear all other column sorts
    const colSorts = {};
    if (sortDir !== null) {
      colSorts[attr] = sortDir;
    }
    this.sendPropUpdate({ colSorts: { $set: colSorts } });
  }

  handleRowSort(attr, sortDir) {
    // Only allow sorting 1 row at a time - clear all other row sorts
    const rowSorts = {};
    if (sortDir !== null) {
      rowSorts[attr] = sortDir;
    }
    this.sendPropUpdate({ rowSorts: { $set: rowSorts } });
  }

  isOpen(dropdown) {
    return this.state.openDropdown === dropdown;
  }

  makeDnDCell(items, onChange, classes) {
    return (
      <Sortable
        options={{
          group: 'shared',
          ghostClass: 'pvtPlaceholder',
          filter: '.pvtFilterBox',
          preventOnFilter: false,
        }}
        tag="td"
        className={classes}
        onChange={onChange}
      >
        {items.map(x => (
          <DraggableAttribute
            name={x}
            key={x}
            attrValues={this.state.attrValues[x]}
            valueFilter={this.props.valueFilter[x] || {}}
            sorter={getSort(this.props.sorters, x, this.state.attrValues[x])}
            menuLimit={this.props.menuLimit}
            setValuesInFilter={this.setValuesInFilter.bind(this)}
            addValuesToFilter={this.addValuesToFilter.bind(this)}
            moveFilterBoxToTop={this.moveFilterBoxToTop.bind(this)}
            removeValuesFromFilter={this.removeValuesFromFilter.bind(this)}
            zIndex={this.state.zIndices[x] || this.state.maxZIndex}
          />
        ))}
      </Sortable>
    );
  }

  render() {
    const aggregations = this.getCurrentAggregations();
    const primaryAggregation = aggregations[0];
    const aggregatorCellOutlet =
      primaryAggregation &&
      this.props.aggregators[primaryAggregation.aggregatorName] &&
      this.props.aggregators[primaryAggregation.aggregatorName]([])().outlet;

    const rendererName =
      this.props.rendererName in this.props.renderers
        ? this.props.rendererName
        : Object.keys(this.props.renderers)[0];

    const rendererCell = (
      <td className="pvtRenderers">
        <Dropdown
          current={rendererName}
          values={Object.keys(this.props.renderers)}
          open={this.isOpen('renderer')}
          zIndex={this.isOpen('renderer') ? this.state.maxZIndex + 1 : 1}
          toggle={() =>
            this.setState({
              openDropdown: this.isOpen('renderer') ? false : 'renderer',
            })
          }
          setValue={this.propUpdater('rendererName')}
        />
      </td>
    );

    const sortIcons = {
      key_a_to_z: {
        rowSymbol: '↕',
        colSymbol: '↔',
        next: 'value_a_to_z',
      },
      value_a_to_z: {
        rowSymbol: '↓',
        colSymbol: '→',
        next: 'value_z_to_a',
      },
      value_z_to_a: { rowSymbol: '↑', colSymbol: '←', next: 'key_a_to_z' },
    };

    const attributeOptions = this.getAttributeOptions();
    const aggregatorCell = (
      <td className="pvtVals">
        {aggregations.map((agg, idx) => {
          const aggDropdownKey = `aggregation-${agg.key}-agg`;
          const numValsAllowed = this.numInputsForAggregator(
            agg.aggregatorName
          );
          const vals = this.defaultValsForAggregator(
            agg.aggregatorName,
            agg.vals
          );
          return (
            <div className="pvtAggregatorRow" key={agg.key || idx}>
              <Dropdown
                current={agg.aggregatorName}
                values={Object.keys(this.props.aggregators)}
                open={this.isOpen(aggDropdownKey)}
                zIndex={
                  this.isOpen(aggDropdownKey) ? this.state.maxZIndex + 1 : 1
                }
                toggle={() =>
                  this.setState({
                    openDropdown: this.isOpen(aggDropdownKey)
                      ? false
                      : aggDropdownKey,
                  })
                }
                setValue={value => this.setAggregationAggregator(idx, value)}
              />
              {numValsAllowed > 0 && (
                <div className="pvtAggregatorVals">
                  {new Array(numValsAllowed).fill().map((n, i) => {
                    const valDropdownKey = `aggregation-${agg.key}-val-${i}`;
                    return (
                      <Dropdown
                        key={`agg-val-${agg.key}-${i}`}
                        current={vals[i]}
                        values={attributeOptions}
                        open={this.isOpen(valDropdownKey)}
                        zIndex={
                          this.isOpen(valDropdownKey)
                            ? this.state.maxZIndex + 1
                            : 1
                        }
                        toggle={() =>
                          this.setState({
                            openDropdown: this.isOpen(valDropdownKey)
                              ? false
                              : valDropdownKey,
                          })
                        }
                        setValue={value =>
                          this.setAggregationVal(idx, i, value)
                        }
                      />
                    );
                  })}
                </div>
              )}
              {aggregations.length > 1 && (
                <button
                  type="button"
                  className="pvtButton pvtRemoveAggregator"
                  onClick={e => {
                    e.stopPropagation();
                    this.removeAggregationRow(idx);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="pvtButton pvtAddAggregator"
          onClick={e => {
            e.stopPropagation();
            this.addAggregationRow();
          }}
        >
          + Add Value
        </button>
        <a
          role="button"
          className="pvtRowOrder"
          onClick={() =>
            this.propUpdater('rowOrder')(sortIcons[this.props.rowOrder].next)
          }
        >
          {sortIcons[this.props.rowOrder].rowSymbol}
        </a>
        <a
          role="button"
          className="pvtColOrder"
          onClick={() =>
            this.propUpdater('colOrder')(sortIcons[this.props.colOrder].next)
          }
        >
          {sortIcons[this.props.colOrder].colSymbol}
        </a>
        {aggregatorCellOutlet && aggregatorCellOutlet(this.props.data)}
        <ConditionalFormattingUI
          tableOptions={this.props.tableOptions}
          onChange={this.sendPropUpdate.bind(this)}
          moveToTop={this.moveFilterBoxToTop.bind(this, 'conditionalFormatting')}
          zIndex={this.state.zIndices.conditionalFormatting || this.state.maxZIndex}
        />
        <CellFormattingUI
          tableOptions={this.props.tableOptions}
          onChange={this.sendPropUpdate.bind(this)}
          moveToTop={this.moveFilterBoxToTop.bind(this, 'cellFormatting')}
          zIndex={this.state.zIndices.cellFormatting || this.state.maxZIndex}
        />
      </td>
    );

    const unusedAttrs = Object.keys(this.state.attrValues)
      .filter(
        e =>
          !this.props.rows.includes(e) &&
          !this.props.cols.includes(e) &&
          !this.props.hiddenAttributes.includes(e) &&
          !this.props.hiddenFromDragDrop.includes(e)
      )
      .sort(sortAs(this.state.unusedOrder));

    const unusedLength = unusedAttrs.reduce((r, e) => r + e.length, 0);
    const horizUnused = unusedLength < this.props.unusedOrientationCutoff;

    const unusedAttrsCell = this.makeDnDCell(
      unusedAttrs,
      order => this.setState({ unusedOrder: order }),
      `pvtAxisContainer pvtUnused ${horizUnused ? 'pvtHorizList' : 'pvtVertList'
      }`
    );

    const colAttrs = this.props.cols.filter(
      e =>
        !this.props.hiddenAttributes.includes(e) &&
        !this.props.hiddenFromDragDrop.includes(e)
    );

    const colAttrsCell = this.makeDnDCell(
      colAttrs,
      this.propUpdater('cols'),
      'pvtAxisContainer pvtHorizList pvtCols'
    );

    const rowAttrs = this.props.rows.filter(
      e =>
        !this.props.hiddenAttributes.includes(e) &&
        !this.props.hiddenFromDragDrop.includes(e)
    );
    const rowAttrsCell = this.makeDnDCell(
      rowAttrs,
      this.propUpdater('rows'),
      'pvtAxisContainer pvtVertList pvtRows'
    );
    const outputCell = (
      <td className="pvtOutput">
        <PivotTable
          {...update(this.props, {
            data: { $set: this.state.materializedInput },
          })}
          colSorts={this.props.colSorts || {}}
          rowSorts={this.props.rowSorts || {}}
          onColSort={this.handleColSort.bind(this)}
          onRowSort={this.handleRowSort.bind(this)}
        />
      </td>
    );

    if (horizUnused) {
      return (
        <table className="pvtUi">
          <tbody onClick={() => this.setState({ openDropdown: false })}>
            <tr>
              {rendererCell}
              {unusedAttrsCell}
            </tr>
            <tr>
              {aggregatorCell}
              {colAttrsCell}
            </tr>
            <tr>
              {rowAttrsCell}
              {outputCell}
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <table className="pvtUi">
        <tbody onClick={() => this.setState({ openDropdown: false })}>
          <tr>
            {rendererCell}
            {aggregatorCell}
            {colAttrsCell}
          </tr>
          <tr>
            {unusedAttrsCell}
            {rowAttrsCell}
            {outputCell}
          </tr>
        </tbody>
      </table>
    );
  }
}

PivotTableUI.propTypes = Object.assign({}, PivotTable.propTypes, {
  onChange: PropTypes.func.isRequired,
  hiddenAttributes: PropTypes.arrayOf(PropTypes.string),
  hiddenFromAggregators: PropTypes.arrayOf(PropTypes.string),
  hiddenFromDragDrop: PropTypes.arrayOf(PropTypes.string),
  unusedOrientationCutoff: PropTypes.number,
  menuLimit: PropTypes.number,
  colSorts: PropTypes.objectOf(PropTypes.oneOf(['ASC', 'DESC'])),
  rowSorts: PropTypes.objectOf(PropTypes.oneOf(['ASC', 'DESC'])),
});

PivotTableUI.defaultProps = Object.assign({}, PivotTable.defaultProps, {
  hiddenAttributes: [],
  hiddenFromAggregators: [],
  hiddenFromDragDrop: [],
  unusedOrientationCutoff: 85,
  menuLimit: 500,
  colSorts: {},
  rowSorts: {},
});

export default PivotTableUI;
