
// SVG drawing area
var margin = {top: 20, right: 40, bottom: 80, left: 55};

var divWidth = $("#chart-area").width();
var width =  divWidth - margin.left - margin.right,
		height = 0.87 * divWidth - margin.top - margin.bottom;

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

// setup legend TEST UPDATE
function setupLegend() {
    var colors = ["#B31B1A", "#225B80"];
    var text = ["Checklists Completed", "Expected"];
    const LEGEND_ENTRY_WIDTH = 25;
    const LEGEND_HORIZONTAL_OFFSET = 0;
    const LEGEND_VERTICAL_OFFSET = 7;
    const LEGEND_ENTRY_PADDING = 150;
    var legend = d3.select("#legend").append("svg")
        .attr("width", 350)
        .attr("height", 30);
    var legendGroup = legend.append("g")
        .attr("transform", "translate(" + LEGEND_HORIZONTAL_OFFSET + "," + LEGEND_VERTICAL_OFFSET + ")");
    legendGroup.selectAll("rect")
        .data(colors)
        .enter()
        .append("rect")
        .attr("x", function(d, i) { return i * (LEGEND_ENTRY_WIDTH + LEGEND_ENTRY_PADDING)})
        .attr("y", 0)
        .attr("width", LEGEND_ENTRY_WIDTH)
        .attr("height", LEGEND_ENTRY_WIDTH)
        .attr("fill", function(d) { return d });

    legendGroup.selectAll("text")
        .data(text)
        .enter()
        .append("text")
        .attr("x", function(d, i) { return LEGEND_ENTRY_WIDTH + 5 + i * (LEGEND_ENTRY_WIDTH + LEGEND_ENTRY_PADDING)})
        .attr("y", 17)
        .text(function(d) { return d });
}

setupLegend();


// global variables
var data, filteredData;
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

// setup interaction for select
d3.select("#unit-select").on("change", function() {

    var selectedValue = +d3.select("#unit-select").property("value");

    // update stats before changing mode; always update table in district mode
    selectedOption.mode = 0;
    var statParameters = { District: selectedValue };
    updateStats(statParameters);

    // update selected option; set to district for all, company for any specific district selection
    selectedOption.mode = selectedValue == 0 ? 0: 1;
    selectedOption.selectedUnit = selectedValue == 0 ? 0: selectedValue;

    updateVisualization();
});

// Load CSV file
function loadData() {
	d3.csv("data/dashboard-mock-data.csv", function(error, csv) {

		if(error) {
			console.log(error);
			return
		}

		// Store csv data in global variable
		data = csv.map(function(value) {
			var fields = ["District", "Structural", "Vehicle", "Other", "Checklists-Completed"];
			fields.forEach(function(field) {
				value[field] = +value[field];
			});
			return value
		});

		console.log(data);

		updateVisualization();
        updateStats();

	});
}


// Render visualization
function updateVisualization() {

	// filter out unwanted units
	filteredData = data.filter(filterData);
	console.log(filteredData);

    // get option selected
    var option = selectedOption.modes[selectedOption.mode];

    // track current height of each bar to allow stacking
    var barHeights = {};

    // update scales
	x.domain(filteredData.map(function(value) {

        // init entry if not created
        if (!barHeights[value[option]]) {
            barHeights[value[option]] = { "completed": 0, "delta": 0 };
        }

        // while updating scale, update totals by unit to enable stacking
        barHeights[value[option]].completed += value["Checklists-Completed"];
        barHeights[value[option]].delta += value.Structural + value.Vehicle + value.Other - value["Checklists-Completed"];

        return value[option];
    }));
    y.domain([0, findMax(barHeights)]);

    // select bar for expected checklists not completed
    var expectedBar = svg.selectAll(".expected-bar")
        .data(filteredData, function(d) { return d.Company});

    expectedBar.enter()
        .append("rect")
        .attr("class", "bar expected-bar")
        .on("click", nextLevel)
        .on("click", updateStats)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    expectedBar
        .style("opacity", 0.5)
        .transition()
        .duration(800)
        .attr("x", function(d) { return x(d[option]) })
        .attr("width", x.rangeBand())
        .attr("y", function(d) {

            var currentDelta = d.Structural + d.Vehicle + d.Other - d["Checklists-Completed"];

            // store current height of bar
            var currentTotalHeight = barHeights[d[option]].completed + barHeights[d[option]].delta;

            // decrement height of bar for next item plotted
            barHeights[d[option]].delta -= currentDelta;

            console.log(y(currentTotalHeight));

            return y(currentTotalHeight);
        })
        .attr("height", function(d) {
            return height - y(d.Structural + d.Vehicle + d.Other - d["Checklists-Completed"]);
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
        .on("click", updateStats)
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
            barHeights[d[option]].completed -= d["Checklists-Completed"];

            return y(currentHeight);
        })
        .attr("height", function(d) { return height - y(d["Checklists-Completed"]); })
        .style("opacity", 1);

    checklistBar.exit()
        .remove();

	// draw axes
	xAxisGroup
		.transition()
		.duration(800)
		.call(xAxis)
        .selectAll("text")
            .style("text-anchor", function() {
                if (selectedOption.mode == 0) {
                    return "middle"
                }

                // for rotation
                else {
                    return "end"
                }
            })
            .attr("transform", function() {
                if (selectedOption.mode == 0) {
                    return "rotate(0)"
                }
                else {

                    // only rotate for companies on x axis
                    return "rotate(-45)"
                }
            });

	yAxisGroup
		.transition()
		.duration(800)
		.call(yAxis);

    // update axes
    yAxisLabel.text("Quantity");
    xAxisLabel.text(function(){ return selectedOption.modes[selectedOption.mode] })
        .attr("y", function() {
            if (selectedOption.mode == 0) {
                return 0
            }
            else {

                // give extra space for labels if displaying companies on x axis
                return 40
            }
        });

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

        // advance to next level in the hierarchy
        selectedOption.mode = (selectedOption.mode + 1) % 2;
        updateVisualization();
    }

}


// show detailed tooltip
function showToolTip(d) {

	var fieldsForMessage = ["Structural", "Vehicle", "Other", "Checklists-Completed"];

    // build message
	var message = "<div id='tooltip-header' class='text-center'><h4>" + d.Company + "</h4></div>" +
        "<div class='company-tip'><table class='table'><tbody>";
    fieldsForMessage.forEach(function(field) {
        message += "<tr><td>" + field + "</td>" + "<td>" + d[field] + "</td></tr>";
    });
    message += "</tbody></table></div>";

    return message
}

// update detailed statistics
function updateStats(d) {

    var fields = ["Structural", "Vehicle", "Other", "Checklists-Completed"];
    var totals = {"Structural": 0, "Vehicle": 0, "Other": 0, "Checklists-Completed": 0};

    // determine mode
    var mode = selectedOption.modes[selectedOption.mode];

    // get unit clicked on
    if (d) {
        var unitClicked = mode == "District" ? d.District: d.Company;
    }

    // if in district mode and no district selected, display aggregate data
    if ((mode == "District" && !unitClicked) || d.District == 0) {
        d3.select("#unit-name").text("Boston Fire Department Totals");

        getTotals(data);

        fields.forEach(function(field) {
            d3.select("#" + field).text(totals[field]);
        });

        d3.select("#total-fires").text(totalFires);
        d3.select("#completion-rate").text(completionRate);

    }

    // if in district mode and district clicked, display total district data
    else if (mode == "District") {
        d3.select("#unit-name").text("District " + unitClicked);
        console.log("district branch");

        // filter data further by district
        var districtStats = data.filter(function(value) {
            console.log(value.District == unitClicked);
            return value.District == unitClicked;
        });

        console.log(unitClicked);
        console.log(districtStats);

        getTotals(districtStats);

        fields.forEach(function(field) {
            d3.select("#" + field).text(totals[field]);
        });

        d3.select("#total-fires").text(totalFires);
        d3.select("#completion-rate").text(completionRate);

    }

    else {
        d3.select("#unit-name").text(unitClicked);
        fields.forEach(function(field) {
            d3.select("#" + field).text(d[field]);
        });
    }

    function getTotals(dataArray) {
        dataArray.forEach(function(company) {
            fields.forEach(function(field) {
                totals[field] += company[field];
            });
        });
    }

    function totalFires() {
        return totals.Structural + totals.Vehicle + totals.Other;
    }

    function completionRate() {
        var total = totalFires();
        var showAsPercent = d3.format(",%");
        return showAsPercent(totals["Checklists-Completed"] / total)
    }
}