# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

react-pivottable-pro is a React-based pivot table library providing drag-and-drop functionality for data exploration and analysis. It's a maintained fork of the original react-pivottable, currently on version 0.11.8, with enhancements by HRForte.

## Development Commands

### Core Development
- `npm start` - Run webpack-dev-server with hot reload on http://localhost:8080
- `npm run build` - Build production version (Babel transpilation with source maps)
- `npm run clean` - Remove build artifacts from src/ and root directory

### Testing
- `npm test` - Run all tests (ESLint, Prettier, Jest)
- `npm run test:eslint` - Run ESLint linting
- `npm run test:prettier` - Check Prettier formatting
- `npm run test:jest` - Run Jest unit tests (tests in __tests__/)

### Deployment
- `npm run deploy` - Build and deploy to GitHub Pages

## Architecture Overview

### Core Component Flow
```
PivotTableUI (interactive) → PivotTable (renderer selector) → Renderers (Table/Plotly) → Output
                                    ↓
                            PivotData (processing engine)
```

### Key Components

1. **PivotTableUI** (`src/PivotTableUI.jsx`)
   - Interactive drag-and-drop interface
   - Manages UI state but requires external state management via `onChange` prop
   - Uses react-sortablejs and react-draggable for interactions

2. **PivotTable** (`src/PivotTable.jsx`)
   - Non-interactive component that delegates to renderers
   - Selects appropriate renderer based on props

3. **PivotData** (`src/Utilities.js`)
   - Core computation engine for data aggregation
   - Processes raw input, handles filtering, sorting
   - Contains aggregator templates (Count, Sum, Average, etc.)

4. **TableRenderers** (`src/TableRenderers.jsx`)
   - Default HTML table renderer
   - Supports conditional formatting, multiple aggregations, interactive sorting

5. **PlotlyRenderers** (`src/PlotlyRenderers.jsx`)
   - Chart-based renderers using Plotly.js
   - Factory pattern for creating chart renderers

### Key Features Implementation

#### Multiple Aggregations
- Configure via `aggregations` prop array (new way) or legacy `aggregatorName`/`vals` props
- Each aggregation: `{ key, aggregatorName, vals, label }`
- Display mode: `aggregationDisplayMode: 'row' | 'column'`

#### Conditional Formatting
- Rule-based styling in TableRenderers.jsx
- Operators: greaterThan, lessThan, equal, contains, beginsWith, endsWith
- Styles: backgroundColor, color, fontWeight, fontStyle

#### Cell Formatting
- Numeric formatting with custom separators, decimal places
- Prefix/suffix for currency, percentages
- Automatically skips formatting for Count, First, Last aggregations

#### Sorting System
Three levels:
1. Global order: `rowOrder`/`colOrder` (key_a_to_z, value_a_to_z, value_z_to_a)
2. Attribute sorters: `sorters` object with built-in or custom functions
3. Interactive UI sorting: `colSorts`/`rowSorts` with ASC/DESC/null states

## Build System

- **Webpack**: Dev server with HMR, entry point at `examples/index.jsx`
- **Babel**: ES6+ and React transformation (.babelrc)
- **ESLint**: Strict rules with React plugin (.eslintrc)
- **Prettier**: Single quotes, no bracket spacing (.prettierrc)

## Data Input Formats

Supports multiple formats:
- Array of objects: `[{a: 1, b: 2}, {a: 2, b: 3}]`
- Array of arrays: `[['a', 'b'], [1, 2], [2, 3]]`
- Function: Returns data asynchronously

## Testing Approach

- Unit tests focus on core data processing in Utilities.js
- Tests located in `__tests__/Utilities-test.js`
- UI components tested manually via dev server
- Example data in `examples/tips.js`

## Extensibility Points

### Custom Aggregators
Use `aggregatorTemplates` in Utilities.js to create new aggregation functions.

### Derived Attributes
Compute values on-the-fly:
```javascript
derivedAttributes: {
  month: record => new Date(record.date).getMonth()
}
```

### Custom Renderers
Follow factory pattern in PlotlyRenderers.jsx:
```javascript
function makeRenderer(PlotlyComponent, traceOptions, layoutOptions, transpose) {
  return class Renderer extends React.PureComponent {
    // Implementation
  }
}
```

## Important Implementation Notes

- Always use React.PureComponent for renderers to prevent unnecessary re-renders
- PivotData processes records in tight loops - avoid heavy operations in aggregators
- Keep aggregator instances stateless to prevent side effects
- The UI component is "dumb" - all state changes must flow through `onChange` callback
- Maintain backward compatibility when extending features