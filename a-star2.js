function shiftDir(pos, d) {
    if (d === 0)
        return [pos[0], pos[1] - 1];
    else if (d === 1)
        return [pos[0] + 1, pos[1]];
    else if (d === 2)
        return [pos[0], pos[1] + 1];
    else
        return [pos[0] - 1, pos[1]];
}

/*
 * 0: Wall (`#`)
  * 1: Empty (`<space>`)
  * 2: Pill
  * 3: Power pill
  * 4: Fruit location
  * 5: Lambda-Man starting position
  * 6: Ghost starting position
*/

function fixCell(cell) {
    return ({ '#': 0, ' ': 1, '.': 2, 'o': 3, '%': 4, '\\': 5, '=': 6 }[cell]);
    //return cell;
}

function canGo(cell) {
    cell = fixCell(cell);
    if (cell === 5)
        return 0;
    if (cell === 1)
        return 127;
    if (cell === 2 || cell === 3 || cell === 4)
        return 137;
    return -1;
}

function bounty(cell) {
    cell = fixCell(cell);
    if (cell === 2)
        return 10000;
    if (cell === 3)
        return 50000; // TODO: 0 if in power mode!
    if (cell === 4)
        return 1000000; //FIXME: only if fruit is present!
    return 0;
}

function slowListSet(list, n, x) {
    if (n === 0)
        return [x, list[1]];
    else
        return [list[0], slowListSet(list[1], n - 1, x)];
}

function slowListGet(list, n) {
    while (n > 0) {
        list = list[1];
        n = n - 1;
    }
    return list[0];
}

function slowMatrixSet(mx, pos, x) {
    slowListSet(mx, pos[0], slowListSet(slowListGet(mx, pos[0]), pos[1], x));
}

function slowMatrixGet(mx, pos, x) {
    slowListGet(slowListGet(mx, pos[0]), pos[1]);
}

function isInt(x) {
    return (typeof x === 'number');
}

function isArray(x) {
    return (typeof x === 'object');
}

function slowListRemove(list, n) {
    if (n === 0)
        return list[1];
    return [list[0], slowListRemove(list[1], n - 1)];
}

function extractMinBy2(list) {
    var minVal = list[0], minIdx = 0;
    var idx = 1;
    var iter = list[1];
    while (isArray(iter)) {
        var val = iter[0];
        if (val[1] < minVal[1]) {
            minVal = val;
            minIdx = idx;
        }
        idx = idx + 1;
        iter = iter[1];
    }

    return [minVal, slowListRemove(list, minIdx)];
}

function slowListLength(list) {
    var n = 0;
    while (isArray(list)) {
        list = list[1];
        n = n + 1;
    }
    return n;
}

function elemToSlowList(x) {
    return [x, 0];
}

function genList(n, f) {
    if (n === 0)
        return 0;
    return [f(), genList(n-1, f)];
}

function genMatrix(X, Y, f) {
    function genListF() {
        genList(Y, f);
    }
    return genList(X, genListF);
}

function calcPaths(map, pos) {

    var X = slowListLength(map);
    var Y = slowListLength(map[0]);

    var T = 0;
    function genCell() {
        return -1;
    }
    var res = genMatrix(X, Y, genCell);
    var toDo = elemToSlowList([pos, 0]);

    while (slowListLength(toDo) > 0) {
        var extractRes = extractMinBy2(toDo);
        var t = extractRes[0][1];
        pos = extractRes[0][0];
        toDo = extractRes[1];

        var d = 0;
        while (d < 4) {
            var newPos = shiftDir(pos, d);
            if (canGo(slowMatrixGet(map, newPos)) >= 0 && slowMatrixGet(res, newPos) === -1) {
                var dt = canGo(slowMatrixGet(map, pos)); //TODO: save in toDo!
                res = slowMatrixSet(res, newPos, t + dt);
                toDo = [[newPos, t + dt], toDo];
            }
            d = d + 1;
        }
    }

    return res;
}

function toHtml(map, arr) {
    var res = '<table border="1" cellspacing="0" cellpadding="0">';
    for(var i = 0; i < map.length; i++) {
        var mapRow = map[i],
            row = arr[i] || [];
        res += '<tr>';
        for(var j = 0; j < mapRow.length; j++) {
            res += '<td>' +
                mapRow[j] +
                '<sup>' + (typeof row[j] === 'undefined' ? '' : row[j]) + '</sup>' +
                '</td>';
        }
        res += '</tr>';
    }
    return res += '</table>'
}

function fixMap(map) {
    return map.reduceRight(function(a, x) {
        x = x.split("").reduceRight(function(b, y) {
            return [y, b];
        }, 0);
        return [x, a];
    }, 0);
}

function unFixRow(row) {
    var res = [];
    while (typeof row === 'object') {
        res.push(row[0]);
        row = row[1];
    }
    return row.join("");
}

function unFixMap(map) {
    var res = [];
    while (typeof map === 'object') {
        res.push(unFixRow(map[0]));
        map = map[1];
    }
    return res;
}

var FS = require('fs'),
    map = FS.readFileSync('map1.txt', 'utf8').split('\n');
FS.writeFileSync('map1.html', toHtml(map, calcPaths(fixMap(map), [16, 11])));

function step(state, map) {
    return [state, 0];
}

[0, step];
