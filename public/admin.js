/* ========================================================================
 * Nooshabe Distribution Game Simulator: admin.js
 * ========================================================================
 * The MIT License (MIT)
 *
 * Copyright (c) 2016-2017 Miron Vranjes. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * ======================================================================== */

var socket = io();
var gameGroup;
var chart;

google.charts.load('current', { packages: ['corechart'] });

// Admin page
$(document).ready(function () {
    

    $('#grouppanel').hide();
    $('#myModal').modal('show');
    $('#btnResetGame').hide();
    $('#btnEndGame').hide();
    $('#charts').hide();

    // Coming in from the dialog
    $("#btnAdmin").click(function () {
        var password = $('#formPassword').val();
        socket.emit('submit password', password, function (msg) {
            if (msg == "Invalid Password") {
                $('#wrongPassword').show();
            } else {
                $('#myModal').modal('hide');
                $('#groupRank').text("# گروه");
                gameGroup = msg.groups;
                refreshTable(gameGroup, msg.numUsers, false);
                $('#grouppanel').show();

                if (msg.status == "started") {
                    startGame(msg.numUsers);
                } else if (msg.status == "ended") {
                    startGame(msg.numUsers);
                    $('#btnEndGame').hide();
                    rankGroups(msg.numUsers);
                }
            }
        });
    });

    // Start the game button
    $("#btnStartGame").click(function () {
        $('#gameStartError').hide();

        let inputVal =$("#numbersInput").val();
        let inventorycost =$("#inventorycost").val();
        let backlogcost = $("#backlogcost").val();
     
        
        if(!backlogcost || !inventorycost){
            alert("لطفا فیلد هزینه خالی را پر کنید");
            return;
        }  
        let numbersArray = inputVal.split(',').map(function(num){
            return parseFloat(num.trim());
        });
        if(numbersArray.length!==5){
            alert("لطفا 5 تقاضا را با ویرگول از هم جدا کنید");
            return;
        }
        var json = {
            numbersArray,
            inventorycost,
            backlogcost
        }
        socket.emit('start game', json, function (msg) {
            if (msg.err) {
                $('#errorText').text('شما بازی را شروع نکرده اید. ' + msg.err);
                $('#gameStartError').show();
            } else {
                $('#groupRank').text("# گروه");
                startGame(msg.numUsers);
            }
        });
    });


    // Reset the game button
    $("#btnResetGame").click(function () {
        $('#btnStartGame').show();
        $('#btnEndGame').hide();
        $('#btnResetGame').hide();
        $('#charts').hide();
        $("#backlogcost").attr("disabled", false);
        $("#inventorycost").attr("disabled", false);
        $("#numbersInput").attr("disabled", false);

        socket.emit('reset game', function (msg) {
            if (msg == "Error") {
                $('#errorText').text('بازی نمیتواند مجددا شروع شود.');
                $('#gameStartError').show();
            } else {
                gameGroup = msg.groups;
                $('#groupRank').text("# گروه");
                refreshTable(gameGroup, msg.numUsers, false);
            }
        });
    });

    // End the game button
    $("#btnEndGame").click(function () {
        $('#btnEndGame').hide();
        $("#backlogcost").attr("disabled", false);
        $("#inventorycost").attr("disabled", false);
        $("#numbersInput").attr("disabled", false);

        socket.emit('end game', function (msg) {
            if (msg == "Error") {
                $('#errorText').text('بازی نمیتواند پایان یابد.');
                $('#gameStartError').show();
            } else {
                gameGroup = msg.groups;

                rankGroups(msg.numUsers);
            }
        });
    });
    
$("#btnStartGame").click(function () {

});


    // Removing a group (in case there are not enough players to start)
    $(document).on('click', '.btnRemoveGroup', function () {
        socket.emit('remove group', $(this).attr("group"), function (msg) {
            if (msg == "Error") {
                $('#errorText').text('گروه را نمی توان حذف کرد.');
                $('#gameStartError').show();
            } else {
                gameGroup = msg.groups;
                refreshTable(gameGroup, msg.numUsers, false);
            }
        });
    });

    // Charting commands
    $("#chartGroup").change(function () {
        var selectedGroup = $("#chartGroup").val();
        var selectedType = $("#chartType").val();
        drawChart(selectedGroup, selectedType);
    });

    $("#chartType").change(function () {
        var selectedGroup = $("#chartGroup").val();
        var selectedType = $("#chartType").val();
        drawChart(selectedGroup, selectedType);
    });
});

// Fired whenever folks join the server
socket.on('update table', function (msg) {
    gameGroup = msg.groups;
    refreshTable(gameGroup, msg.numUsers, false);
});

// Fired whenever a group has finished a week
socket.on('update group', function (msg) {
    gameGroup[msg.groupNum] = msg.groupData;

    refreshTable(gameGroup, msg.numUsers, true);

    var selectedGroup = $("#chartGroup").val();
    var selectedType = $("#chartType").val();
    drawChart(selectedGroup, selectedType);
});

// Changes the UI when the game starts
function startGame(numUsers) {
    $('#btnStartGame').hide();
    $('#btnEndGame').show();
    $('#btnResetGame').show();
    if (numUsers == 1) {
        var numParticipants = "یک شرکت کننده";
    } else {
        var numParticipants = numUsers + ' شرکت کننده. ';
    }

    $('#status').text(' بازی با  ' + numParticipants + " شرکت کننده شروع شده ");
    $("#backlogcost").attr("disabled", true);
    $("#inventorycost").attr("disabled", true);
    $("#numbersInput").attr("disabled", true);

    refreshTable(gameGroup, numUsers, true);
    showChart();
}

// Sorts the groups by the money they made
function rankGroups(numUsers) {
    $('#groupRank').text("رتبه");
    var lowestWeek = gameGroup[gameGroup.length - 1].week;
    for (var i = 0; i < gameGroup.length; i++) {
        if (gameGroup[i].week < lowestWeek) lowestWeek = gameGroup[i].week;
        console.log(gameGroup[i].costHistory);
    }

    gameGroup.sort(function (a, b) {
        console.log(a.costHistory[lowestWeek - 1] + " vs " + b.costHistory[lowestWeek - 1]);
        return a.costHistory[lowestWeek - 1] - b.costHistory[lowestWeek - 1];
    });

    refreshTable(gameGroup, numUsers, true);
}

// Start showing the fancy charts
function showChart() {
    $("#chartGroup").empty(); // remove old options

    for (var i = 0; i < gameGroup.length; i++) {
        $("#chartGroup").append($("<option></option>").attr("value", i).text(i + 1));
    }

    $('#charts').show();

    var selectedGroup = $("#chartGroup").val();
    var selectedType = $("#chartType").val();
    drawChart(selectedGroup, selectedType);
}

// Updates the table of users (this happens in real time)
function refreshTable(groups, numUsers, gameStarted) {
    $('#grouptable > tbody').html("");
    for (var i = 0; i < groups.length; i++) {
        var week = gameStarted ? " (هفته " + groups[i].week + ", ریال" + parseFloat(groups[i].cost).toFixed(0) + ")" : ""
        $('#grouptable > tbody').append('<tr id=\'group' + i + '\'><td>' + (i + 1) + week + '</td></tr>');
        var userDisconnected = false;
        for (var j = 0; j < 4; j++) {
            if (groups[i].users[j]) {
                if (groups[i].users[j].socketId) {
                    var userCell = '<td>' + groups[i].users[j].name + '</td>';
                } else {
                    userDisconnected = true;
                    var userCell = '<td>' + groups[i].users[j].name + ' (قطع شده)</td>';
                }
            } else {
                var userCell = '<td></td>';
            }
            $('#group' + i).append(userCell);
        }

        if (!gameStarted) {
            $('#group' + i).append('<td><button type="button" class="btn btn-danger btn-xs btnRemoveGroup" group="' + i + '"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button></td>');
        }

        if (userDisconnected) $('#group' + i).addClass("danger");
    }

    gameGroup = groups;

    if (numUsers == 1) {
        var numParticipants = "درحال حاظر 1 شرکت کننده.";
    } else {
        var numParticipants = 'در حال حاظر  ' + numUsers + ' شرکت کننده.';
    }

    $('#status').text(numParticipants);
}

// The details of the fancy charts
function drawChart(group, type) {
    if (!chart) chart = new google.visualization.LineChart(document.getElementById('groupChart'));
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'X');

    var groupToShow = gameGroup[group];

    for (var i = 0; i < gameGroup[group].users.length; i++) {
        data.addColumn('number', gameGroup[group].users[i].role.name);
    }

    for (var i = 1; i < gameGroup[group].week; i++) {
        var dataRow = [i.toString()];
        for (var j = 0; j < gameGroup[group].users.length; j++) {
            var numToPush = 0;
            switch (type) {
                case "Cost":
                    numToPush = gameGroup[group].users[j].costHistory[i];
                    vAxisTitle = "هزینه(ریال)";
                    break;
                case "Inventory":
                    numToPush = parseInt(gameGroup[group].users[j].inventoryHistory[i]) - parseInt(gameGroup[group].users[j].backlogHistory[i]);
                    vAxisTitle = "موجودی(واحد)";
                    break;
                case "Orders":
                    numToPush = gameGroup[group].users[j].orderHistory[i];
                    vAxisTitle = "سفارش(واحد)";
                    break;
                default:
            }

            dataRow.push(numToPush);
        }
        data.addRows([dataRow]);
    }

    var vAxisTitle = "";
    var chartTitle = "گروه " + parseInt(parseInt(group) + 1);
    switch (type) {
        case "Cost":
            vAxisTitle = "هزینه(ریال)";
            break;
        case "Inventory":
            vAxisTitle = "موجودی(واحد)";
            break;
        case "Orders":
            vAxisTitle = "سفارش(واحد)";
            break;
        default:
    }

    var options = {
        hAxis: {
            title: 'هفته #'
        },
        vAxis: {
            title: vAxisTitle
        },
        series: {
            1: { curveType: 'function' }
        },
        'legend': 'bottom',
        'title': chartTitle,
        'width': 675,
        'height': 250
    };

    chart.draw(data, options);
}

// export {numbersArray};