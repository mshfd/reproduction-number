/* Reusable, pure d3 Checkbox */

function d3CheckBox () {

    var size = 20,
        x = 0,
        y = 0,
        rx = 0,
        ry = 0,
        markStrokeWidth = 1.5,
        boxStrokeWidth = 1.5,
        color = "gray",
        checked = false,
        clickEvent;

    function checkBox (selection) {

        var g = selection.append("g"),
            box = g.append("rect")
            .attr("width", size)
            .attr("height", size)
            .attr("x", x)
            .attr("y", y)
            .attr("rx", rx)
            .attr("ry", ry)
            .style("fill-opacity", 0)
            .style("stroke-width", boxStrokeWidth)
            .style("stroke", color);

        //Data to represent the check mark
        var coordinates = [
            {x: x + (size / 8), y: y + (size / 2)},
            {x: x + (size / 2.2), y: (y + size * 1.3)},
            {x: (x + size) - (size / 8), y: (y + (size / 10))}
        ];

        var line = d3.line()
                .x(function(d){ return d.x; })
                .y(function(d){ return d.y; })
                .curve(d3.curveBundle, 1.0);

        let mark = g.append("path");
        mark.attr("d", line(coordinates))
            .style("stroke-width", markStrokeWidth)
            .style("stroke", "black")
            .style("fill", "none")
            .style("opacity", (checked)? 1 : 0);

        g.on("click", function () {
            checked = !checked;
            mark.style("opacity", (checked)? 1 : 0);

            if(clickEvent) {
                clickEvent();
            }

            d3.event.stopPropagation();
        });

    }

    checkBox.size = function (val) {
        size = val;
        return checkBox;
    }

    checkBox.x = function (val) {
        x = val;
        return checkBox;
    }

    checkBox.y = function (val) {
        y = val;
        return checkBox;
    }

    checkBox.rx = function (val) {
        rx = val;
        return checkBox;
    }

    checkBox.ry = function (val) {
        ry = val;
        return checkBox;
    }

    checkBox.markStrokeWidth = function (val) {
        markStrokeWidth = val;
        return checkBox;
    }

    checkBox.boxStrokeWidth = function (val) {
        boxStrokeWidth = val;
        return checkBox;
    }

    checkBox.checked = function (val) {

        if(val === undefined) {
            return checked;
        } else {
            checked = val;
            return checkBox;
        }
    }

    checkBox.clickEvent = function (val) {
        clickEvent = val;
        return checkBox;
    }

    return checkBox;
}