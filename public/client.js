var socket = io();

var curWeek = 0;
var curUser = null;
var numUsers = 0;
var submittedOrder = false;
var userIdx = 0;
var curGroup;
var gameEnded = false;

var countOptions = {
    useEasing: true,
    useGrouping: true,
    separator: ',',
    decimal: '.',
    prefix: '',
    suffix: ''
};

// Login
$(document).ready(function () {
    $('#board').hide();
    $('#myModal').modal('show');

    // Dialog for logging in
    $("#btnLogin").click(function (event) {
        event.preventDefault();
        if ($(this).hasClass("disabled")) return;
        var username = $('#formUsername').val();
        socket.emit('submit username', username, function (msg) {
            console.log(msg);
            if (msg == "Invalid Username") {
                $('#errorText').text('این نام کاربری قبلا انتخاب شده، نام دیگری انتخاب کنید.');
                $('#errorDialog').show();
            } else if (msg == "Game Started") {
                $('#errorText').text('این بازی شروع شده و اعضای جدید نمیتوانند وارد شوند.');
                $('#errorDialog').show();
            } else {
                userIdx = msg.idx;
                curGroup = msg.group;
                curUser = msg.group.users[userIdx];
                curWeek = msg.group.week;
                numUsers = msg.numUsers;
                gameEnded = msg.gameEnded;

                $('#formUsername').val('');
                $('#errorDialog').hide();
                $('#myModal').modal('hide');
                $('#role').text('نقش شما: ' + curUser.role.name);
                $('#username').text('وارد شده به عنوان ' + curUser.name);

                if (curWeek > 0 && !gameEnded) {
                    nextTurn(numUsers, curWeek, curUser);
                    if (curGroup.waitingForOrders.length > 0) {
                        submittedOrder = true;
                        $("#formOrderAmount").val(curUser.role.upstream.orders);
                        $("#btnOrder").attr("disabled", true);
                        $("#formOrderAmount").attr("disabled", true);
                        updateWait();
                    }
                    $('#board').show();
                    $('#lobby').hide();
                } else if (gameEnded) {
                    updateStatus();
                    updateTable(true);
                } else {
                    updateStatus();
                    updateTable(false);
                }
            }
        });
    });

    // Submitting an order
    $("#btnOrder").click(function () {
        event.preventDefault();
        if ($(this).hasClass("disabled")) return;
        var orderAmount = $('#formOrderAmount').val();

        var curCost = parseInt($('#cstAmt').text());
        var costCount = new CountUp("cstAmt", curCost, parseFloat(curUser.cost).toFixed(0), 0, 3, countOptions);
        costCount.start();

        socket.emit('submit order', orderAmount, function (msg) {
            submittedOrder = true;
            $('#newOrder').fadeOut("fast");
            $("#btnOrder").attr("disabled", true);
            $("#formOrderAmount").attr("disabled", true);
            console.log(msg)
            updateWait(msg);
        });
    });

    // Accepting a delivery
    $("#btnDeliver").click(function () {
        $('#acceptDelivery').fadeOut("fast");
        $('#upstreamShipments').addClass('animated bounceInRight');
        $('#upstreamShipments').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
            $('#upstreamShipments').removeClass('animated bounceInRight');
            $('#curInventory').addClass('animated bounce');
            $('#curInventory').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                $('#curInventory').removeClass('animated bounce');
                var curInventory = parseInt($('#inventoryAmt').text());
                var inventoryCount = new CountUp("inventoryAmt", curInventory, curInventory + curUser.role.upstream.shipments, 0, 2, countOptions);
                var shipmentCount = new CountUp("usShpAmt", curUser.role.upstream.shipments, 0, 0, 2, countOptions);
                shipmentCount.start();
                inventoryCount.start(function () {
                    $('#fulfillText').text(curUser.role.downstream.name + " منتظر برآورده شدن درخواست اش است! تا جایی که میتوانید درخواست او را برآورده کنید");
                    $('#fulfillOrder').fadeIn("fast");
                });
            });
        });
    });

    // Fulfilling an order
    $("#btnFulfill").click(function () {
        $('#fulfillOrder').fadeOut("fast");
        $('#downstreamOrders').addClass('animated bounceInLeft');
        $('#downstreamOrders').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
            $('#downstreamOrders').removeClass('animated bounceInLeft');
            $('#curInventory').addClass('animated bounce');
            $('#curInventory').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                $('#curInventory').removeClass('animated bounce');
                var curInventory = parseInt($('#inventoryAmt').text());
                var inventoryCount = new CountUp("inventoryAmt", curInventory, curUser.inventory, 0, 2, countOptions);

                var curBacklog = parseInt($('#bklgAmt').text());
                var backlogCount = new CountUp("bklgAmt", curBacklog, curUser.backlog, 0, 2, countOptions);
                var shipmentCount = new CountUp("dsShpAmt", 0, curUser.role.downstream.shipments, 0, 2, countOptions);

                var orderCountdown = new CountUp("dsOrdrAmt", curUser.role.downstream.orders, 0, 0, 3, countOptions);
                

                backlogCount.start();
                inventoryCount.start();
                orderCountdown.start();

                shipmentCount.start(function () {
                    $('#downstreamShipments').addClass('animated bounce');
                    $('#downstreamShipments').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                        $('#downstreamShipments').removeClass('animated bounce');
                        $('#downstreamShipments').addClass('animated bounceOutLeft');
                        $('#downstreamShipments').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                            $('#downstreamShipments').removeClass('animated bounceOutLeft');

                            if (curUser.role.name == "National/Donor") {
                                $('#orderText').text(".زمان ثبت سفارش برای کارخانه است! برای ثبت سفارش فرم زیر را پر کنید");
                            } else {
                                $('#orderText').text("زمان سفارش از " + curUser.role.upstream.name + "  رسیده!  برای ثبت سفارش فرم سفارش را در زیر پر کنید.");
                            }

                            $('#newOrder').fadeIn("fast");
                            $("#btnOrder").attr("disabled", false);
                            $("#formOrderAmount").attr("disabled", false);
                        });
                    });
                });
            });
        });
    });

    // Go to the next turn
    $('#nextTurn').on('hidden.bs.modal', function (e) {
        if (curWeek != 0 && !gameEnded) {
            var LastorderAmount = $('#formOrderAmount').val();
            $('#formOrderAmount').val('');

            var shipmentCount = new CountUp("usShpAmt", 0, curUser.role.upstream.shipments, 0, 3, countOptions);
            shipmentCount.start();

            var orderCount = new CountUp("dsOrdrAmt", 0, curUser.role.downstream.orders, 0, 3, countOptions);
            // var orderCount2 = new CountUp("dsOrdrAmt", 0, curUser.role.downstream.orders, 0, 2, countOptions);
            console.log(curUser.role.downstream)
            if(curWeek > 1 && curUser.role.downstream.name !== "مشتری"){
                alert(" سفارش " + curUser.role.downstream.name + " در دوره قبل "  +  curUser.role.downstream.PrevOrders + " بوده است ")

            }
            orderCount.start();

            // This is a bit hacky because it depends on how you call the roles :(
            if (curUser.role.name == "کارخانه") {
                $('#deliveryText').text("شما یک تحویل جدید از تامین کننده اصلی دارید. برای شروع آن را بپذیرید!");
            } else {
                $('#deliveryText').text(" یک ارسال جدید از طرف " + curUser.role.upstream.name + " دارید. " + "برای شروع تایید کنید!");
            }

            $('#acceptDelivery').fadeIn("fast");
        }
    });
});

// Update the # of users in real time
socket.on('user joined', function (msg) {
    numUsers = msg.numUsers;
    updateStatus();
});

// Update the # of users in real time
socket.on('user left', function (msg) {
    numUsers = msg.numUsers;
    updateStatus();
});

// Kicked out of the group
socket.on('change group subscription', function (msg) {
    socket.emit('change group', msg);
});

// You were kicked out by the admin
socket.on('kicked out', function (msg) {
    socket.emit('ack getting kicked');

    resetUser();

    hideGameBoard();

    $('#myModal').modal('show');
});

// Someone joined your specific group
socket.on('group member joined', function (msg) {
    curGroup.users[msg.idx] = msg.update;
    $('#grouptable > tbody > tr').each(function (i) {
        if (msg.idx == i) {
            $(this).html('<td>' + (i + 1) + '</td><td>' + (msg.idx == userIdx ? curGroup.users[i].name : 'بازیکن ' + (i + 1)) + '</td><td>' + msg.update.role.name + '</td>');

            if (msg.update.socketId) {
                $(this).removeClass("danger");
            }
        }
    });
});

// Someone left your specific group
socket.on('group member left', function (msg) {
    $('#grouptable > tbody > tr').each(function (i) {
        if (msg.idx == i && !msg.update.socketId && msg.idx != userIdx) {
            $(this).html('<td>' + (i + 1) + '</td><td>بازیکن ' + (i + 1) + ' (قطع شد)</td><td>' + msg.update.role.name + '</td>');
            $(this).addClass("danger");
        }
    });
});

// Since this is real time, we must wait on others before advancing to the next week
function updateWait(msg) {
    if (msg && submittedOrder) {
        var listOfUsers = "";
        for (var i = 0; i < msg.length; i++) {
            if (i != 0 && i != msg.length - 1 && msg.length > 1) listOfUsers += ", ";
            if (i == msg.length - 1 && msg.length > 1) listOfUsers += " و ";
            listOfUsers += msg[i];
        }

        $('#waitingText').text(" سفارش شماارسال شد. در حال حاظر منتظر سفارش " + listOfUsers +" هستیم ");
        $('#waitingOnUsers').fadeIn("fast");
    } else {
        $('#waitingOnUsers').fadeOut("fast");
    }
}

// Updates the table in real time
function updateTable(showNames) {
    $('#grouptable > tbody > tr').each(function (i) {
        if (curGroup.users[i] && i != userIdx) {
            if (curGroup.users[i].socketId) {
                $(this).removeClass("danger");
                $(this).html('<td>' + (i + 1) + '</td><td>' + (showNames ? curGroup.users[i].name : 'بازیکن ' + (i + 1)) + '</td><td>' + curGroup.users[i].role.name + '</td>');
            } else {
                if (curGroup.users[i].role.name) {
                    $(this).html('<td>' + (i + 1) + '</td><td>' + (showNames ? curGroup.users[i].name : 'بازیکن ' + (i + 1)) + ' (قطع شد)</td><td>' + curGroup.users[i].role.name + '</td>');
                    $(this).addClass("danger");
                } else {
                    $(this).html('<td>' + (i + 1) + '</td><td>...انتظار</td><td>' + curGroup.users[i].role.name + '</td>');
                    $(this).removeClass("danger");
                }
            }
        }

        if (i == userIdx) {
            $(this).html('<td>' + (i + 1) + '</td><td>' + curGroup.users[i].name + '</td><td>' + curGroup.users[i].role.name + '</td>');
            $(this).addClass("active");
        }
    });
}

// Reset everything about the user in case the game is reset
function resetUser() {
    curWeek = 0;
    curUser = null;
    numUsers = 0;
    submittedOrder = false;
    userIdx = 0;
    curGroup = null;
    gameEnded = false;

    $('#grouptable > tbody > tr').each(function (i) {
        $(this).removeClass("danger");
        $(this).html('<td>' + (i + 1) + '</td><td>...انتظار</td><td></td>');
    });
}

// Updates the status message to reflect the state of the game
function updateStatus() {
    if (numUsers == 1) {
        var numParticipants = "درحال حاظر 1 شرکت کننده.";
    } else {
        var numParticipants = 'درحال حاظر ' + numUsers + ' بازیکن.';
    }

    if (curWeek > 0 && !gameEnded) {
        $('#participants').text('بازی شروع شد! در هفته ' + curWeek + "هستید. " + numParticipants);
    } else if (!gameEnded) {
        $('#participants').text('در انتظار برای شروع بازی. ' + numParticipants);
    } else {
        $('#participants').text('بازی به اتمام رسید. بازی در هفته ' + curWeek + "به اتمام رسید. " + numParticipants);
    }
}

// Next turn (week) logic
function nextTurn(users, week, user) {
    curUser = user;
    numUsers = users;
    curWeek = week;

    updateStatus();

    $('#downstreamRole').text(curUser.role.downstream.name);
    $('#upstreamRole').text(curUser.role.upstream.name);
    $('#userRole').text(curUser.role.name + " (شما)");

    $('#dsShpAmt').text('0');

    if (curWeek > 0) {
        $('#cstAmt').text(parseFloat(curUser.costHistory[curWeek - 1]).toFixed(0));
        $('#inventoryAmt').text(curUser.inventoryHistory[curWeek - 1]);
        $('#bklgAmt').text(curUser.backlogHistory[curWeek - 1]);
    } else {
        $('#cstAmt').text('0');
    }

    $("#btnOrder").attr("disabled", true);
    $("#formOrderAmount").attr("disabled", true);

    $("span.weekText").text("هفته " + week);
    $("span.upstreamName").text(curUser.role.upstream.name);
    $("span.downstreamName").text(curUser.role.downstream.name);

    $('#nextTurn').modal('show');
}

// The game board disappears when the game is over
function hideGameBoard() {
    $('#board').hide();
    $('#nextTurn').modal('hide');

    $('#waitingOnUsers').hide();
    $('#acceptDelivery').hide();
    $('#fulfillOrder').hide();
    $('#newOrder').hide();
}

// React to the game starting (setup the UI)
socket.on('game started', function (msg) {
    nextTurn(msg.numUsers, msg.week, curUser);
    gameEnded = false;

    $('#board').show();
    $('#lobby').hide();
});

// React to the game ending (go to lobby)
socket.on('game reset', function (msg) {
    gameEnded = false;
    $('#lobby').show();
    curWeek = msg.week;
    numUsers = msg.numUsers;

    hideGameBoard();

    updateTable(false);
    updateStatus();
});

// React to the game ending (go to lobby)
socket.on('game ended', function (msg) {
    gameEnded = true;
    $('#lobby').show();
    numUsers = msg.numUsers;

    hideGameBoard();

    updateTable(true);
});

// Got a message that someone in the group sent an order
socket.on('update order wait', function (msg) {
    updateWait(msg);
});

// Go to the next turn
socket.on('next turn', function (msg) {
    console.log(msg);

    $('#waitingOnUsers').fadeOut("fast");
    submittedOrder = false;

    nextTurn(msg.numUsers, msg.week, msg.update);
});