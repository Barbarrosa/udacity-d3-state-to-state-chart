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
                .sort((a,b) => b.values - a.values);

            fromStates.forEach(
                (d, i) => d.totalBefore = d3.sum(
                    fromStates.slice(0,i),
                    (b) => b.values
                )
            );

            var toStates = d3.nest()
                .key((d) => d.Current)
                .rollup((d) => d3.sum(d, (b) => b.Estimate))
                .entries(state.data)
                .sort((a,b) => b.values - a.values);

            toStates.forEach(
                (d, i) => d.totalBefore = d3.sum(
                    toStates.slice(0,i),
                    (b) => b.values
                )
            );


            var migrateMax = Math.max(
                    d3.max(fromStates, (d) => d.totalBefore + d.values),
                    d3.max(toStates, (d) => d.totalBefore + d.values)
                );

            var y = d3.scale.linear()
                .domain([0,migrateMax])
                .range([0,state.innerHeight]);

            var yOpacity = d3.scale.linear()
                .domain([0,migrateMax])
                .range([1,0.2]);

            var barWidth = state.innerWidth/15;

            chart.selectAll('rect.state-from')
                .data(fromStates)
                .enter().append('rect')
                    .classed('state-bar', true)
                    .classed('state-from', true)
                    .attr('width', barWidth)
                    .attr('height', (d) => y(d.values))
                    .attr('x', 0)
                    .attr('y', (d) => y(d.totalBefore))
                    .attr('opacity', (d) => yOpacity(d.totalBefore));

            chart.selectAll('rect.state-to')
                .data(toStates)
                .enter().append('rect')
                    .classed('state-bar', true)
                    .classed('state-to', true)
                    .attr('width', barWidth)
                    .attr('height', (d) => y(d.values))
                    .attr('x', state.innerWidth - barWidth)
                    .attr('y', (d) => y(d.totalBefore))
                    .attr('opacity', (d) => yOpacity(d.totalBefore));

            var toStateFromBuckets = toStates.reduce((r,d) => {
                r[d.key] = {
                    state: d.key,
                    total: d.value,
                    buckets: state.data
                        .filter((s) => s.Current === d.key)
                        .sort((s1,s2) => s2.Estimate - s1.Estimate)
                        .reduce((r,s) => {
                            r.states[s.Previous] = {
                                toState: s.Current,
                                fromState: s.Previous,
                                offset: d.totalBefore + r.runningTotalBefore,
                                length: s.Estimate,
                                error: s.Error
                            };
                            r.runningTotalBefore += s.Estimate;
                            return r;
                        }, {states:{}, runningTotalBefore:0}).states
                };
                return r;
            }, {});

            var fromStateToBuckets = fromStates.map((d) => ({
                state: d.key,
                total: d.value,
                buckets: state.data
                    .filter((s) => s.Previous === d.key)
                    .reduce((r,s) => {
                        r.states.push({
                            toState: s.Current,
                            fromState: s.Previous,
                            offset: d.totalBefore + r.runningTotalBefore,
                            length: s.Estimate,
                            error: s.Error
                        });
                        r.runningTotalBefore += s.Estimate;
                        return r;
                    }, {states:[], runningTotalBefore:0}).states
                    .sort((s1,s2) => s2.length - s1.length)
            }));

            var migrationLineGroup = chart.selectAll('g.stateMigrationLineGroup')
                .data(fromStateToBuckets);

            migrationLineGroup.enter().append('g')
                .classed('stateMigrationLineGroup', true);

            migrationLineGroup.selectAll('polygon.stateMigrationLine')
                .data((d) => d.buckets)
                .enter().append('polygon')
                    .classed('stateMigrationLine', true)
                    .attr('points', (d) => {
                        var toState = toStateFromBuckets[d.toState].buckets[d.fromState];
                        var points = [
                            [
                                barWidth,
                                y(d.offset)
                            ],
                            [
                                barWidth,
                                y(d.offset + d.length)
                            ],
                            [
                                state.innerWidth - barWidth,
                                y(toState.offset + toState.length)
                            ],
                            [
                                state.innerWidth - barWidth,
                                y(toState.offset)
                            ]
                        ];
                        return points.map((p) => p.join(',')).join(' ');
                    });


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

d3.csv('State_to_State_Migrations_Table_2011.csv', function(d){
    d.Estimate = d.Estimate === 'N/A' ? 0 : parseInt(d.Estimate);
    d.Error = d.Error === 'N/A' ? 0 : parseInt(d.Error);
    return d;
}, function(data) {
    var slopeGraph = new MigrationSlopeGraph({
        svg: document.getElementById('mainChart'),
        height:900,
        data: data
    });
    slopeGraph.createGraph();
});
