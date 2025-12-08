import React from 'react';
import tips from './tips';
import TableRenderers from '../src/TableRenderers';
import createPlotlyComponent from 'react-plotly.js/factory';
import createPlotlyRenderers from '../src/PlotlyRenderers';
import PivotTableUI from '../src/PivotTableUI';
// import { builtInSorters } from '../src/Utilities'; // Available for custom sorters
import '../src/pivottable.css';
import Dropzone from 'react-dropzone';
import Papa from 'papaparse';

const Plot = createPlotlyComponent(window.Plotly);

class PivotTableUISmartWrapper extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = { pivotState: props };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({ pivotState: nextProps });
    }

    render() {
        return (
            <PivotTableUI
                renderers={Object.assign(
                    {},
                    TableRenderers,
                    createPlotlyRenderers(Plot)
                )}
                {...this.state.pivotState}
                onChange={s => this.setState({ pivotState: s })}
                unusedOrientationCutoff={Infinity}
            />
        );
    }
}

export default class App extends React.Component {
    componentWillMount() {
        this.setState({
            mode: 'demo',
            filename: 'Sample Dataset: Tips',
            pivotState: {
                data: tips,
                rows: ['salesperson', 'date', 'product', 'region', 'unitsSold', 'revenue'],
                cols: [],
                aggregatorName: 'Count',
                vals: [],
                // Demo: Multiple aggregations grouped by type
                aggregations: [
                    // { key: 'count-tips', aggregatorName: 'Count', vals: ['Employee Ref'], label: 'Count of Employee Ref' },
                    // { key: 'sum-total', aggregatorName: 'Count', vals: ['Claim Amount'], label: 'Count by Claim Amount' },
                    { key: 'sum-claim', aggregatorName: 'Sum', vals: ['unitsSold'], label: 'Sum by unitsSold' },
                    { key: 'sum-2', aggregatorName: 'Sum', vals: ['revenue'], label: 'Sum by revenue' },
                ],
                rendererName: 'Grouped Columns by Type',
                // Custom sorters example:
                // You can specify sorters in multiple ways:
                // 1. By data type name (string): 'number', 'date', 'string', 'stringCaseInsensitive', 'natural'
                // 2. By providing sample values (array): The system will auto-detect the data type
                // 3. By providing a custom function: (a, b) => a - b
                sorters: {
                    // Example: Use number sorter for numeric columns
                    // 'Total Bill': 'number',
                    // 'Tip': 'number',
                    // Example: Use date sorter for date columns
                    // 'Date': 'date',
                    // Example: Use case-insensitive string sorter
                    // 'Day': 'stringCaseInsensitive',
                    // Example: Custom sorter function
                    // 'Smoker': (a, b) => {
                    //     // Custom logic: 'Yes' before 'No'
                    //     if (a === 'Yes' && b === 'No') return -1;
                    //     if (a === 'No' && b === 'Yes') return 1;
                    //     return a > b ? 1 : a < b ? -1 : 0;
                    // },
                    // Example: Auto-detect by providing sample values
                    // 'SomeColumn': ['value1', 'value2', 'value3'],
                },
                colSortIcons: {
                    ASC: <div>Ngoc Nguyen</div>,
                    DESC: '←',
                    DEFAULT: '↔',
                },
                rowSortIcons: {
                    ASC: <div>Ngoc Nguyen</div>,
                    DESC: '↓',
                    DEFAULT: '⇅',
                },
                plotlyOptions: { width: 900, height: 500 },
                plotlyConfig: {},
                tableOptions: {
                    clickCallback: function (e, value, filters, pivotData) {
                        var names = [];
                        pivotData.forEachMatchingRecord(filters, function (
                            record
                        ) {
                            names.push(record.Meal);
                        });
                    },
                    // Conditional formatting example
                    conditionalFormatting: {
                        rules: [
                            // Highlight values greater than 20 with green background
                            {
                                condition: {
                                    type: 'greaterThan',
                                    value: 20
                                },
                                style: {
                                    backgroundColor: '#90EE90',
                                    fontWeight: 'bold'
                                }
                            },
                            // Highlight values less than 5 with red background
                            {
                                condition: {
                                    type: 'lessThan',
                                    value: 5
                                },
                                style: {
                                    backgroundColor: '#FFB6C1',
                                    color: '#8B0000',
                                    fontWeight: 'bold'
                                }
                            },
                            // Highlight empty values with yellow background
                            {
                                condition: {
                                    type: 'empty'
                                },
                                style: {
                                    backgroundColor: '#FFFFE0',
                                    fontStyle: 'italic'
                                }
                            }
                        ]
                    },
                    // Cell formatting example - format all numeric values
                    cellFormatting: {
                        rules: [
                            {
                                format: {
                                    thousandsSep: '',      // Thousand separator (e.g., 1,000). Use '' (empty string) to skip separator (decimal formatting still applies)
                                    decimalSep: '.',        // Decimal separator (e.g., 1.23)
                                    decimalPlaces: 2,       // Number of decimal places (0-9)
                                    prefix: '',            // Prefix (e.g., $, €, ¥)
                                    suffix: '',             // Suffix (e.g., %, units)
                                    showOriginal: false     // Set to true to show original value without any formatting (no decimal places, separators, prefix, or suffix)
                                }
                            }
                            // You can add multiple rules, but only the first one will be used
                            // (all rules apply to all values)
                        ]
                    }
                },
            },
        });
    }

    onDrop(files) {
        this.setState(
            {
                mode: 'thinking',
                filename: '(Parsing CSV...)',
                textarea: '',
                pivotState: { data: [] },
            },
            () =>
                Papa.parse(files[0], {
                    skipEmptyLines: true,
                    error: e => alert(e),
                    complete: parsed =>
                        this.setState({
                            mode: 'file',
                            filename: files[0].name,
                            pivotState: { data: parsed.data },
                        }),
                })
        );
    }

    onType(event) {
        Papa.parse(event.target.value, {
            skipEmptyLines: true,
            error: e => alert(e),
            complete: parsed =>
                this.setState({
                    mode: 'text',
                    filename: 'Data from <textarea>',
                    textarea: event.target.value,
                    pivotState: { data: parsed.data },
                }),
        });
    }

    render() {
        return (
            <div>
                <div className="row text-center">
                    <div className="col-md-3 col-md-offset-3">
                        <p>Try it right now on a file...</p>
                        <Dropzone
                            onDrop={this.onDrop.bind(this)}
                            accept="text/csv"
                            className="dropzone"
                            activeClassName="dropzoneActive"
                            rejectClassName="dropzoneReject"
                        >
                            <p>
                                Drop a CSV file here, or click to choose a file
                                from your computer.
                            </p>
                        </Dropzone>
                    </div>
                    <div className="col-md-3 text-center">
                        <p>...or paste some data:</p>
                        <textarea
                            value={this.state.textarea}
                            onChange={this.onType.bind(this)}
                            placeholder="Paste from a spreadsheet or CSV-like file"
                        />
                    </div>
                </div>
                <div className="row text-center">
                    <p>
                        <em>Note: the data never leaves your browser!</em>
                    </p>
                    <br />
                </div>
                <div className="row">
                    <h2 className="text-center">{this.state.filename}</h2>
                    <div className="text-center" style={{ padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '5px', margin: '10px 0' }}>
                        <p><strong>New Feature Demo:</strong> Multiple aggregations grouped by type with total values!</p>
                        <p>This demo shows 6 aggregations grouped into 3 charts by their function type, displaying the grand total for each:</p>
                        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                            <li><strong>Count Chart:</strong> Total Count of Tips, Total Count by Gender</li>
                            <li><strong>Average Chart:</strong> Total Average Bill, Total Average Tip</li>
                            <li><strong>Sum Chart:</strong> Total Sum of Bills, Total Sum of Tips</li>
                        </ul>
                        <p>Each bar shows the grand total for that aggregation. Try switching between different chart types!</p>
                    </div>
                    <br />

                    <PivotTableUISmartWrapper {...this.state.pivotState} />
                </div>
            </div>
        );
    }
}
