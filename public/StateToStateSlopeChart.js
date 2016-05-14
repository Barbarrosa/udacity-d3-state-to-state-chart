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
            state.title = config.title || 'Label not set';
            state.leftLabel = config.leftLabel || 'Label not set';
            state.rightLabel = config.rightLabel || 'Label not set';
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
            state.created = false;
            state.matchingWidth = false;
            state.config = config;
            stateMap.set(this, state);
        }
        matchWidthToParent(matchWidth) {
            var state = stateMap.get(this);
            var wasMatchingWidth = state.matchingWidth;
            state.matchingWidth = matchWidth;
            if(matchWidth) {
                var newWidth = state.svg.parentElement.clientWidth;
                if(state.width !== newWidth) {
                    var oldWidth = state.width;
                    state.width = Math.min(
                        Math.max(
                            state.svg.parentElement.clientWidth,
                            state.config.minWidth || 0
                        ),
                        state.config.maxWidth || state.svg.parentElement.clientWidth
                    );
                    state.innerWidth = state.width - (state.margin.right + state.margin.left);
                    if(state.created) {
                        d3.select(state.svg).html('');
                        this.createGraph();
                    }
                }
            } else if(wasMatchingWidth) {
                state.width = state.config.width;
                if(state.created) {
                    d3.select(state.svg).html('');
                    this.createGraph();
                }
            }
        }
        createGraph() {
            var state = stateMap.get(this);
            state.created = true;

            var niceFormat = d3.format('.2s');
            var barWidth = state.innerWidth/8;

            var svg = d3.select(state.svg)
                .attr('width', state.width)
                .attr('height', state.height);

            var chart = svg.append('g')
                .classed('slope-chart', true)
                .attr('width', state.innerWidth)
                .attr('height', state.innerHeight);

            svg.append('text')
                .classed('chart-title', true)
                .text(state.title)
                .attr('text-anchor', 'middle')
                .attr('transform', 'translate(' + state.width/2 + ',0)')
                .attr('dy', '1em');

            svg.append('text')
                .classed('column-title', true)
                .text(state.leftLabel)
                .attr('text-anchor', 'start')
                .attr('transform', 'translate(0,' + state.margin.top + ')')
                .attr('dy', '-0.2em');

            svg.append('text')
                .classed('column-title', true)
                .text(state.rightLabel)
                .attr('text-anchor', 'end')
                .attr('transform', 'translate(' + state.width + ',' + state.margin.top + ')')
                .attr('dy', '-0.2em');

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
                    .attr('class', (d) => 'state-group state-from-group state-from-group-' + d.key.replace(/ /g, '-'))
                    .on('mouseover', function(d){
                        chart.classed('filtered', true);
                        chart.classed('filtered-from', true);
                        d3.selectAll('.line-from-' + d.key.replace(/ /g,'-'))
                            .classed('line-hover-from', true)
                            .each(function(z){
                                this.parentNode.appendChild(this);
                                var toState = toStateFromBuckets[z.toState].buckets[z.fromState];
                                chart.selectAll('.state-to-group-' + z.toState.replace(/ /g, '-') + ' .state-to-from-count')
                                    .text('+' + niceFormat(z.length))
                                    .classed('state-count-active', true);
                                chart.append('rect')
                                    .classed('to-slice', true)
                                    .attr('x', state.margin.left + state.innerWidth - barWidth)
                                    .attr('y', y(toState.offset))
                                    .attr('height', heightScale(toState.length))
                                    .attr('width', barWidth);
                            });
                        d3.select(this).select('.state-count')
                            .style('font-size', 16);
                    })
                    .on('mouseout', function(d){
                        chart.classed('filtered', false);
                        chart.classed('filtered-from', false);
                        d3.selectAll('.line-from-' + d.key.replace(/ /g,'-'))
                            .classed('line-hover-from', false);
                        chart.selectAll('rect.to-slice').remove();
                        chart.selectAll('.state-to-from-count')
                            .text('')
                            .classed('state-count-active', false);
                        d3.select(this).select('.state-count')
                            .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5));
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

            fromGroup.append('text')
                .classed('state-count', true)
                .classed('state-from-count', true)
                .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5))
                .text((d) => niceFormat(d.values))
                .attr('x', (d) => state.margin.left)
                .attr('y', (d) => y(d.totalBefore))
                .attr('text-anchor', 'end')
                .attr('dx', -5)
                .attr('dy', '1em');

            fromGroup.append('text')
                .classed('state-count', true)
                .classed('state-from-to-count', true)
                .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5))
                .attr('x', (d) => state.margin.left)
                .attr('y', (d) => y(d.totalBefore))
                .attr('text-anchor', 'end')
                .attr('dx', -5)
                .attr('dy', '1em');

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
                    .attr('class', (d) => 'state-group state-to-group state-to-group-' + d.key.replace(/ /g, '-'))
                    .on('mouseover', function(d){
                        chart.classed('filtered', true);
                        chart.classed('filtered-to', true);
                        d3.selectAll('.line-to-' + d.key.replace(/ /g,'-'))
                            .classed('line-hover-to', true)
                            .each(function(z){
                                this.parentNode.appendChild(this);
                                chart.selectAll('.state-from-group-' + z.fromState.replace(/ /g, '-') + ' .state-from-to-count')
                                    .text('-' + niceFormat(z.length))
                                    .classed('state-count-active', true);
                                chart.append('rect')
                                    .classed('from-slice', true)
                                    .attr('x', state.margin.left)
                                    .attr('y', y(z.offset))
                                    .attr('height', heightScale(z.length))
                                    .attr('width', barWidth);
                            });
                        d3.select(this).select('.state-count')
                            .style('font-size', 16)
                    })
                    .on('mouseout', function(d){
                        chart.classed('filtered', false);
                        chart.classed('filtered-to', false);
                        d3.selectAll('.line-to-' + d.key.replace(/ /g,'-'))
                            .classed('line-hover-to', false);
                        chart.selectAll('rect.from-slice').remove();
                        chart.selectAll('.state-from-to-count')
                            .text('')
                            .classed('state-count-active', false);
                        d3.select(this).select('.state-count')
                            .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5))
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

            toGroup.append('text')
                .classed('state-count', true)
                .classed('state-to-count', true)
                .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5))
                .text((d) => niceFormat(d.values))
                .attr('text-anchor', 'end')
                .attr('x', (d) => state.width)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dx', -5)
                .attr('dy', '1em');

            toGroup.append('text')
                .classed('state-count', true)
                .classed('state-to-from-count', true)
                .style('font-size', (d) => Math.min(16, heightScale(d.values)/1.5))
                .attr('text-anchor', 'end')
                .attr('x', (d) => state.width)
                .attr('y', (d) => y(d.totalBefore))
                .attr('dx', -5)
                .attr('dy', '1em');

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
                        return 'stateMigrationLine line-from-' + d.fromState.replace(/ /g,'-') + ' line-to-' + d.toState.replace(/ /g,'-');
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

            var yFlipped = d3.scale.linear()
                .domain([migrateMax,0])
                .range([state.margin.top,state.margin.top + state.innerHeight]);

            var yAxis = d3.svg.axis()
                .scale(yFlipped)
                .orient('left')
                .ticks(15)
                .tickSubdivide(1)
                .tickSize(0, 6, 0)
                .tickFormat(niceFormat);

            var leftAxisGroup = svg.append('g')
                .classed('y-axis', true)
                .call(yAxis);

            leftAxisGroup.insert('rect', '.tick')
                .attr('width', '2.5em')
                .attr('height', state.innerHeight)
                .attr('transform', 'translate(' + (-leftAxisGroup.node().getBoundingClientRect().width/2) + ',' + state.margin.top +')')
                ;

            leftAxisGroup.attr('transform', 'translate(' + (state.margin.left + barWidth/2 + leftAxisGroup.node().getBoundingClientRect().width/2) + ',0)')

            var rightAxisGroup = svg.append('g')
                .classed('y-axis', true)
                .call(yAxis);

            rightAxisGroup.insert('rect', '.tick')
                .attr('width', '2.5em')
                .attr('height', state.innerHeight)
                .attr('transform', 'translate(' + (-rightAxisGroup.node().getBoundingClientRect().width/2) + ',' + state.margin.top + ')')
                ;

            rightAxisGroup.attr('transform', 'translate(' + (state.width - (state.margin.right + barWidth/2) + rightAxisGroup.node().getBoundingClientRect().width/2) + ',0)')
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
        title: 'U.S. State-to-State Migration Estimates, 2011',
        rightLabel: 'Inbound',
        leftLabel: 'Outbound',
        maxWidth: 1500,
        minWidth: 900,
        height:965,
        margin: {
            top: 105,
            right: 250,
            bottom: 5,
            left: 250
        },
        data: data
    });

    // Manual debounce
    var matchWidthTimeout = null;
    var matchWidthCb = function(){
        if(matchWidthTimeout) clearTimeout(matchWidthTimeout);
        matchWidthTimeout = setTimeout(function(){
            slopeGraph.matchWidthToParent(true);
        }, 250);
    };

    window.addEventListener('resize', matchWidthCb);

    slopeGraph.matchWidthToParent(true);
    slopeGraph.createGraph();
});
