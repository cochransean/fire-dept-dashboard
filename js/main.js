
// SVG drawing area
var margin = {top: 40, right: 40, bottom: 40, left: 55};

var width = 600 - margin.left - margin.right,
		height = 520 - margin.top - margin.bottom;

var svg = d3.select("#chart-area").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Scales
var x = d3.scale.ordinal()
	.rangeRoundBands([0, width],.1);

var y = d3.scale.linear()
	.range([height, 0]);

// Axes
var yAxisGroup = svg.append("g")
	.attr("class", "y-axis axis");

var yAxis = d3.svg.axis()
	.scale(y)
	.orient("left");

var xAxisGroup = svg.append("g")
	.attr("class", "x-axis axis")
	.attr("transform", "translate(0," + height + ")");

var xAxis = d3.svg.axis()
	.scale(x)
	.orient("bottom");

// global variables
var data;
var selectedOption = {
	"modes": ["District", "Company"],
	"mode": 0,
	"selectedUnit": 0
};

// Initialize data
loadData();

// setup tooltip
var tip = d3.tip().attr('class', 'd3-tip').html(function(d) { return showToolTip(d) });

// offset to allow clicking on circle
tip.offset([-10, 0]);
svg.call(tip);

// append axis labels
var yAxisLabel = svg.append("text")
    .attr("transform", "translate(" + -40 + "," + height / 2 + ") rotate(90)")
    .attr("class", "axis axis-label");

var xAxisLabel = svg.append("text")
    .attr("transform", "translate(" + width / 2 + "," + (height + 35) + ")")
    .attr("class", "axis axis-label");

// Load CSV file
function loadData() {
	d3.csv("data/dashboard-mock-data.csv", function(error, csv) {

		if(error) {
			console.log(error);
			return
		}

		// Store csv data in global variable
		data = csv.map(function(value) {
			var fields = ["District", "Structural", "Vehicle", "Other", "Checklists Completed"];
			fields.forEach(function(field) {
				value[field] = +value[field];
			});
			return value
		});

		console.log(data);

		updateVisualization();

	});
}


// Render visualization
function updateVisualization() {

	// filter out unwanted years
	var filteredData = data.filter(filterData);
	console.log(filteredData);

    // get option selected
    var option = selectedOption.modes[selectedOption.mode];

	var xDomain = filteredData.map(function(value) {
        return value[option];
    });

    // track current height of each bar to allow stacking
    var barHeights = {};
    console.log(barHeights);

    // update scales
	x.domain(filteredData.map(function(value) {

        // init entry if not created
        if (!barHeights[value[option]]) {
            barHeights[value[option]] = { "completed": 0, "delta": 0 };
        }

        // while updating scale, update totals by unit to enable stacking
        barHeights[value[option]].completed += value["Checklists Completed"];
        barHeights[value[option]].delta += value.Structural + value.Vehicle + value.Other - value["Checklists Completed"];

        return value[option];
    }));
    y.domain([0, findMax(barHeights)]);

    console.log(barHeights);

    // select bar for expected checklists not completed
    var expectedBar = svg.selectAll(".expected-bar")
        .data(filteredData, function(d) { return d.Company});

    expectedBar.enter()
        .append("rect")
        .attr("class", "bar expected-bar")
        .on("click", nextLevel)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    expectedBar
        .style("opacity", 0.5)
        .transition()
        .duration(800)
        .attr("x", function(d) { return x(d[option]) })
        .attr("width", x.rangeBand())
        .attr("y", function(d) {

            var currentDelta = d.Structural + d.Vehicle + d.Other - d["Checklists Completed"];

            // store current height of bar
            var currentTotalHeight = barHeights[d[option]].completed + barHeights[d[option]].delta;

            // decrement height of bar for next item plotted
            barHeights[d[option]].delta -= currentDelta;

            console.log(y(currentTotalHeight));

            return y(currentTotalHeight);
        })
        .attr("height", function(d) {
            return height - y(d.Structural + d.Vehicle + d.Other - d["Checklists Completed"]);
        })
        .style("opacity", 1);

    expectedBar.exit()
        .remove();

    // select checklist bars
    var checklistBar = svg.selectAll(".checklist-bar")
        .data(filteredData, function(d) { return d.Company});

    checklistBar.enter()
        .append("rect")
        .attr("class", "bar checklist-bar")
        .on("click", nextLevel)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    // update as required
    checklistBar
        .style("opacity", 0.5)
        .transition()
        .duration(800)
        .attr("x", function(d) { return x(d[option]) })
        .attr("width", x.rangeBand())
        .attr("y", function(d) {

            // store current height of bar
            var currentHeight = barHeights[d[option]].completed;

            // decrement height of bar for next item plotted
            barHeights[d[option]].completed -= d["Checklists Completed"];

            return y(currentHeight);
        })
        .attr("height", function(d) { return height - y(d["Checklists Completed"]); })
        .style("opacity", 1);

    checklistBar.exit()
        .remove();

	// draw axes
	xAxisGroup
		.transition()
		.duration(800)
		.call(xAxis);



	yAxisGroup
		.transition()
		.duration(800)
		.call(yAxis);

    // update axis label
    yAxisLabel.text("Quantity");
    xAxisLabel.text(function(){ return selectedOption.modes[selectedOption.mode] });

	// HELPER FUNCTIONS
    // filters out items not in currently selected date range
	function filterData(value) {

		console.log(selectedOption.modes[selectedOption.mode]);

		// return all items if district is selected
		if (selectedOption.modes[selectedOption.mode] === "District") {
			return true
		}

        // only return district clicked on
		else if (selectedOption.modes[selectedOption.mode] === "Company") {
			return value.District === selectedOption.selectedUnit;
		}

        // TODO filter to one company if bottom of hierarchy
	}

    function findMax(dataObject) {
        var keys = d3.keys(dataObject);
        var max = 0;
        keys.forEach(function(key){
            var currentValue = dataObject[key].completed + dataObject[key].delta;
            max = currentValue > max ? currentValue : max;
        });
        console.log(max);
        return max
    }

    function nextLevel(d) {

        // update unit to reflect the next level down the hierarchy and the item that was clicked on
        if (selectedOption.modes[selectedOption.mode] === "District") {
            selectedOption.selectedUnit = d.District;
        }

        else if (selectedOption.modes[selectedOption.mode] === "Company") {
            selectedOption.selectedUnit = d.Company;
        }

        // TODO else must have selected individual company

        // advance to next level in the hierarchy
        selectedOption.mode = (selectedOption.mode + 1) % 2;
        updateVisualization();
    }

}

// show details tooltip
function showToolTip(d) {

	var fieldsForMessage = ["Structural", "Vehicle", "Other", "Checklists Completed"];

    // build message
	var message = "<div id='tooltip-header' class='text-center'><h4>" + d.Company + "</h4></div>" +
        "<div class='company-tip'><table class='table'><tbody>";
    fieldsForMessage.forEach(function(field) {
        message += "<tr><td>" + field + "</td>" + "<td>" + d[field] + "</td></tr>";
    });
    message += "</tbody></table></div>";

    return message
}