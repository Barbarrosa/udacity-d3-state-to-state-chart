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

            var barWidth = state.innerWidth/22;

            var svg = d3.select(state.svg);
            svg.attr('width', state.width).attr('height', state.height);

            var chart = svg.append('g')
                .classed('slope-chart', true)
                .attr('width', state.innerWidth)
                .attr('height', state.innerHeight);

            svg.append('text')
                .classed('column-title', true)
                .text('Outbound')
                .attr('x', 0)
                .attr('y', '1em');

            svg.append('text')
                .classed('column-title', true)
                .text('Inbound')
                .attr('x', state.margin.left + state.innerWidth - barWidth/2)
                .attr('y', '1em');

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
                .range([state.margin.top,state.margin.top + state.innerHeight]);

            var heightScale = d3.scale.linear()
                .domain([0,migrateMax])
                .range([0,state.innerHeight]);

            var yOpacity = d3.scale.linear()
                .domain([0,migrateMax])
                .range([1,0.2]);

            var fromGroup = chart.selectAll('g.state-from-group')
                .data(fromStates)
                .enter().append('g')
                    .classed('state-from-group', true)
                    .on('mouseover', function(d){
                        chart.classed('filtered', true);
                        chart.classed('filtered-from', true);
                        d3.selectAll('.line-from-' + d.key.replace(' ','-'))
                            .classed('line-hover-from', true)
                            .each(function(z){
                                this.parentNode.appendChild(this);
                                var toState = toStateFromBuckets[z.toState].buckets[z.fromState];
                                chart.append('rect')
                                    .classed('to-slice', true)
                                    .attr('x', state.margin.left + state.innerWidth - barWidth)
                                    .attr('y', y(toState.offset))
                                    .attr('height', heightScale(toState.length))
                                    .attr('width', barWidth);
                            });
                    })
                    .on('mouseout', function(d){
                        chart.classed('filtered', false);
                        chart.classed('filtered-from', false);
                        d3.selectAll('.line-from-' + d.key.replace(' ','-'))
                            .classed('line-hover-from', false);
                        chart.selectAll('rect.to-slice').remove();
                    });

            fromGroup.append('rect')
                .classed('label', true)
                .classed('label-from', true)
                .attr('width', state.margin.left)
                .attr('height', (d) => heightScale(d.values))
                .attr('x', 0)
                .attr('y', (d) => y(d.totalBefore));

            fromGroup.filter((d) => heightScale(d.values) > 3.3).append('text')
                .classed('state-from-text', true)
                .style('font-size', (d) => heightScale(d.values)/1.5)
                .text((d) => d.key)
                .attr('x', (d) => 0)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dy',(d) => heightScale(d.values)/1.5);

            fromGroup.append('text')
                .classed('state-from-text-hover', true)
                .style('font-size', (d) => Math.max(16, heightScale(d.values)/1.5))
                .text((d) => d.key)
                .attr('x', (d) => 0)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dy',(d) => heightScale(d.values)/1.5);

            fromGroup.append('rect')
                .classed('state-bar', true)
                .classed('state-from', true)
                .attr('width', barWidth)
                .attr('height', (d) => heightScale(d.values))
                .attr('x', state.margin.left)
                .attr('y', (d) => y(d.totalBefore))
                .attr('opacity', (d) => yOpacity(d.totalBefore));

            var toGroup = chart.selectAll('g.state-to-group')
                .data(toStates)
                .enter()
                    .append('g')
                    .classed('state-to-group', true)
                    .on('mouseover', function(d){
                        chart.classed('filtered', true);
                        chart.classed('filtered-to', true);
                        d3.selectAll('.line-to-' + d.key.replace(' ','-'))
                            .classed('line-hover-to', true)
                            .each(function(z){
                                this.parentNode.appendChild(this);
                                chart.append('rect')
                                    .classed('from-slice', true)
                                    .attr('x', state.margin.left)
                                    .attr('y', y(z.offset))
                                    .attr('height', heightScale(z.length))
                                    .attr('width', barWidth);
                            });
                    })
                    .on('mouseout', function(d){
                        chart.classed('filtered', false);
                        chart.classed('filtered-to', false);
                        d3.selectAll('.line-to-' + d.key.replace(' ','-'))
                            .classed('line-hover-to', false);
                        chart.selectAll('rect.from-slice').remove();
                    });

            toGroup.append('rect')
                .classed('label', true)
                .classed('label-to', true)
                .attr('width', state.margin.right)
                .attr('height', (d) => heightScale(d.values))
                .attr('x', state.width - state.margin.right)
                .attr('y', (d) => y(d.totalBefore));

            toGroup.filter((d) => heightScale(d.values) > 3.3).append('text')
                .classed('state-to-text', true)
                .style('font-size', (d) => heightScale(d.values)/1.5)
                .text((d) => d.key)
                .attr('x', (d) => state.margin.left + state.innerWidth)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dy',(d) => heightScale(d.values)/1.5);

            toGroup.append('text')
                .classed('state-to-text-hover', true)
                .style('font-size', (d) => Math.max(16, heightScale(d.values)/1.5))
                .text((d) => d.key)
                .attr('x', (d) => state.margin.left + state.innerWidth)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dy',(d) => heightScale(d.values)/1.5);

            toGroup.append('rect')
                .classed('state-bar', true)
                .classed('state-to', true)
                .attr('width', barWidth)
                .attr('height', (d) => heightScale(d.values))
                .attr('x', state.margin.left + state.innerWidth - barWidth)
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
                    .sort((s1,s2) => s2.Estimate - s1.Estimate)
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
            }));

            var lineData = fromStateToBuckets
                .reduce((r,d) => {
                    Array.prototype.push.apply(r,d.buckets);
                    return r;
                }, []);

            chart.selectAll('polygon.stateMigrationLine')
                .data(lineData)
                .enter().append('polygon')
                    .attr('class', (d) => {
                        return 'stateMigrationLine line-from-' + d.fromState.replace(' ','-') + ' line-to-' + d.toState.replace(' ','-');
                    })
                    .attr('points', (d) => {
                        var toState = toStateFromBuckets[d.toState].buckets[d.fromState];
                        var points = [
                            [
                                state.margin.left + barWidth,
                                y(d.offset)
                            ],
                            [
                                state.margin.left + barWidth,
                                y(d.offset + d.length)
                            ],
                            [
                                state.margin.left + state.innerWidth - barWidth,
                                y(toState.offset + toState.length)
                            ],
                            [
                                state.margin.left + state.innerWidth - barWidth,
                                y(toState.offset)
                            ]
                        ];
                        return points.map((p) => p.join(',')).join(' ');
                    });
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
        width: 900,
        margin: {
            top: 55,
            right: 200,
            bottom: 5,
            left: 200
        },
        data: data
    });
    slopeGraph.createGraph();
});
