var MigrationSlopeGraph = (function(){
    var stateMap = new WeakMap();
    class MigrationSlopeGraph{
        constructor(config) {
            if( ! (config instanceof Object)) {
                throw new Error('MigrationSlopeGraph configuration must be an object.');
            }

            if( ! ('svg' in config && 'nodeName' in config.svg)) {
                throw new Error('The MigrationSlopeGraph "svg" configuration key must contain a DOM Node.');
            }

            if( ! ('data' in config && config.data instanceof Array)) {
                throw new Error('The MigrationSlopeGraph "data" configuration key must contain an array.');
            }

            var state = {};
            state.svg = config.svg;
            state.data = config.data;
            state.label = config.label || 'Label not set';
            state.leftLabel = config.leftLabel || 'Label not set';
            state.rightLabel = config.rightLabel || 'Label not set';
            state.increaseColor = config.increaseColor || '#77C';
            state.decreaseColor = config.decreaseColor || '#C77';
            state.width = config.width || 650;
            state.height = config.height || 650;
            state.margin = config.margin || {
                top: 20,
                right: 20,
                bottom: 20,
                left: 20
            };
            state.innerWidth = state.width - state.margin.left - state.margin.right;
            state.innerHeight = state.height - state.margin.top - state.margin.bottom;
            state.partition = config.partition || 100;
            stateMap.set(this, state);
        }
        createGraph() {
            var state = stateMap.get(this);

            var svg = d3.select(state.svg);
            svg.attr('width', state.width).attr('height', state.height);

            var chart = svg.append('g')
                .classed('slope-chart', true)
                .attr('width', state.innerWidth)
                .attr('height', state.innerHeight);

            var fromStates = d3.nest()
                .key((d) => d.Previous)
                .rollup((d) => d3.sum(d, (b) => b.Estimate))
                .entries(state.data)
                .sort((a,b) => b - a);

            var toStates = d3.nest()
                .key((d) => d.Current)
                .rollup((d) => d3.sum(d, (b) => b.Estimate))
                .entries(state.data)
                .sort((a,b) => b - a);

            var migrateMax = Math.max(
                    d3.max(fromStates, (d) => d.values),
                    d3.max(toStates, (d) => d.values)
                );

            var y = d3.scale.linear()
                .domain([0,migrateMax])
                .range([0,state.innerHeight]);

            var barWidth = state.innerWidth/15;

            chart.selectAll('rect.state-from')
                .data(fromStates)
                .enter().append('rect')
                    .classed('state-from', true)
                    .attr('width', barWidth)
                    .attr('height', (d) => y(d.values))
                    .attr('x', 0)
                    .attr('y', (d) => y(d.values));

            chart.selectAll('rect.state-to')
                .data(toStates)
                .enter().append('rect')
                    .classed('state-to', true)
                    .attr('width', barWidth)
                    .attr('height', (d) => y(d.values))
                    .attr('x', state.innerWidth - barWidth)
                    .attr('y', (d) => y(d.values));

            // chart.selectAll('g.chart-line')
            //     .data(state.data)
            //     .enter().append('g')
            //         .classed('chart-line', true)
            //         .attr('x1', (d) => )
            //         .attr('y1', (d) => )
            //         .attr('x2', (d) => )
            //         .attr('y2', (d) => );
        }
    }
    return MigrationSlopeGraph;
}());

d3.csv('State_to_State_Migrations_Table_2011.csv', function(data) {
    var slopeGraph = new MigrationSlopeGraph({
        svg: document.getElementById('mainChart'),
        data: data
    });
    slopeGraph.createGraph();
});
