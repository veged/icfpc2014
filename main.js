function listGet(list2, n) {
    var size = list2[0];
    var list = list2[1];
    var m;
    while (size !== 1) {
        m = (size / 2) | 0;
        if (n < m) {
            list = list[0];
            size = m;
        } else {
            list = list[1];
            size = size - m;
            n = n - m;
        }
    }
    return list;
}

function listSet(list, n, x) {
    var size = list[0];
    var s = size;
    list = list[1];
    var stack = 0;

    while (s > 1) {
        var m = (s / 2) | 0;
        if (n < m) {
            s = m;
            stack = [[1, list[1]], stack];
            list = list[0];
        } else {
            s = s - m;
            n = n - m;
            stack = [[0, list[0]], stack];
            list = list[1];
        }
    }

    var res = x;

    while (typeof stack === 'object') {
        var head = stack[0];
        if (head[0]) {
            res = [res, head[1]];
        } else {
            res = [head[1], res];
        }
        stack = stack[1];
    }
    return [size, res];
}

function listLength(list) {
    return list[0];
}

function slowListLength(list) {
    var n = 0;
    while (typeof list === 'object') {
        list = list[1];
        n = n + 1;
    }
    return n;
}

function listFromSlowList(arr, f) {

    function _listFromSlowList(arr, n, i) {
        if (n === 1) {
            return [f(arr[0], i), arr[1]];
        }
        var m = (n / 2) | 0;
        var left = _listFromSlowList(arr, m, i);
        var right = _listFromSlowList(left[1], n - m, i + m);
        return [[left[0], right[0]], right[1]];
    }

    var len = slowListLength(arr);
    return [len, _listFromSlowList(arr, len, 0)[0]];
}

function listIterate(list, f) {
    var i = 0;
    function _listIterate(list, length, i) {
        if(length === 1) {
            f(list, i);
        } else {
            var halfLength = (length / 2) | 0;
            _listIterate(list[0], halfLength, i);
            _listIterate(list[1], length - halfLength, i + halfLength);
        }
    }
    _listIterate(list[1], list[0], 0);
}

function matrixSet(mx, pos, x) {
    return listSet(mx, pos[1], listSet(listGet(mx, pos[1]), pos[0], x));
}

function matrixGet(mx, pos, x) {
    return listGet(listGet(mx, pos[1]), pos[0]);
}

function matrixIterate(mx, f) {
    function rowIterate(row, i) {
        function cellIterate(v, j) {
            f(v, i, j);
        }
        listIterate(row, cellIterate);
    }
    listIterate(mx, rowIterate);
}

function genList(n, f) {
    function _genList(n) {
        if (n === 1)
            return f();
        var m = (n / 2) | 0;
        return [ _genList(m), _genList(n-m) ];
    }
    return [n, _genList(n)];
}

function genMatrix(X, Y, f) {
    function genListF() {
        return genList(X, f);
    }
    return genList(Y, genListF);
}

function shiftDir(pos, d) {
    if (d === 0) {
        return [pos[0], pos[1] - 1];
    } else if (d === 1) {
        return [pos[0] + 1, pos[1]];
    } else if (d === 2) {
        return [pos[0], pos[1] + 1];
    } else {
        return [pos[0] - 1, pos[1]];
    }
}

// heap struct: [[value, size], [ptr1, ptr2]]
function heapPop(heap) {
    var val = heap[0];
    var x = val[0];
    var size = val[1];
    var ptr = heap[1];
    var p, res;
    if (typeof ptr[0] === 'number') {
        if (typeof ptr[1] === 'number') {
            return [x, 0];
        } else {
            p = 1;
        }
    } else {
        if (typeof ptr[1] === 'number') {
            p = 0;
        } else {
            var x0 = ptr[0][0][0];
            var x1 = ptr[1][0][0];
            if (x0[0] < x1[0]) {
                p = 0;
            } else {
                p = 1;
            }
        }
    }

    if (p) {
        res = heapPop(ptr[1]);
        return [x, [[res[0], size-1], [ptr[0], res[1]]]];
    } else {
        res = heapPop(ptr[0]);
        return [x, [[res[0], size-1], [res[1], ptr[1]]]];
    }
}

function heapSize(heap) {
    if (typeof heap === 'number')
        return 0;
    return heap[0][1];
}

function heapPush(heap, x) {
    if (typeof heap === 'number') {
        return [[x, 1], [0, 0]];
    }
    var val = heap[0];
    var y = val[0];
    var size = val[1];
    var ptr = heap[1];

    if (x[0] < y[0]) {
        var z = x; x = y; y = z;
    }
    if (heapSize(ptr[0]) > heapSize(ptr[1])) {
        return [[y, size + 1], [ptr[0], heapPush(ptr[1], x)]];
    } else {
        return [[y, size + 1], [heapPush(ptr[0], x), ptr[1]]];
    }
}

function heapSort(arr) {
    // descending
    var heap = 0;
    while (typeof arr === 'object') {
        heap = heapPush(heap, arr[0]);
        arr = arr[1];
    }
    var res = 0;
    while (heapSize(heap) > 0) {
        var pop = heapPop(heap);
        res = [pop[0], res];
        heap = pop[1];
    }
    return res;
}


function flatRow(row, f, b) {

    function _flatRow(row, x, n, a) {
        if (n === 1) {
            return f(x, row, a);
        }
        var m = (n / 2) | 0;
        a = _flatRow(row[1], x + m, n - m, a);
        return _flatRow(row[0], x, m, a);
    }

    return _flatRow(row[1], 0, row[0], b);
}

function flatMatrix(mx) {

    function processRow(y, d, tail) {

        function processCell(x, r, tail) {
            if (r >= 0) {
                return [[r, [x, y]], tail];
            } else {
                return tail;
            }
        }

        return flatRow(d, processCell, tail);
    }

    return flatRow(mx, processRow, 0);
}

function flatAndSort(mx) {
    var val = flatMatrix(mx);
    return heapSort(val);
}

function run(map, myPos) {
}

function id(x, i) {
    return x;
}
function convertRow(x, i) {
    var val = listFromSlowList(x, id);
    return val;
}

function matrixFromSlowMatrix(mx) {
    return listFromSlowList(mx, convertRow);
}

function tplGet(tpl, length, i) {
    if(i === 0) {
        return tpl[0];
    } else if(i === 1 && length === 2) {
        return tpl[1];
    } else {
        return tplGet(tpl[1], length - 1, i - 1);
    }
}

function tplGetter(tpl, length) {
    function getter(i) {
        return tplGet(tpl, length, i);
    }
    return getter;
}


function mod(n, d) {
    return n - ((n / d) | 0) * d;
}

var _next = 42;
function rand() {
    _next = (_next * 1103515245 + 12345) | 0;
    return mod(((_next / 65536) | 0), 32768);
}

function slowListMap(list, f) {
    if (typeof list === 'number')
        return list;
    return [f(list[0]), slowListMap(list[1], f)];
}

function oppositeDir(d) {
    d = d + 2;
    if (d >= 4)
        d = d - 4;
    return d;
}

function step(aiState, worldState) {
    worldState = tplGetter(worldState, 4);
    var map = worldState(0),
        lmStatus = tplGetter(worldState(1), 5),
        lmVitality = lmStatus(0),
        ghostsStatuses = worldState(2),
        fruitStatus = worldState(3),
        ghostsStartingPositions = 0,
        unplacedGhosts = ghostsStatuses;

    function convertMapRow(x, j) {
        var allGhosts = unplacedGhosts, ghostsInRow = 0;
        unplacedGhosts = 0;
        while(typeof allGhosts === 'object') {
            var ghost = allGhosts[0],
                ghostPos = tplGet(ghost, 3, 1);
            allGhosts = allGhosts[1];
            if (ghostPos[1] === j) {
                ghostsInRow = [ghost, ghostsInRow];
            } else {
                unplacedGhosts = [ghost, unplacedGhosts];
            }
        }

        function convertMapCell(x, i) {
            var allGhosts = ghostsInRow, ghostInCell = 0;
            ghostsInRow = 0;
            while(typeof allGhosts === 'object') {
                var ghost = allGhosts[0],
                    ghostPos = tplGet(ghost, 3, 1);
                allGhosts = allGhosts[1];
                if (ghostPos[0] === i && tplGet(ghost, 3, 0) !== 2) {
                    ghostInCell = 6
                } else {
                    ghostsInRow = [ghost, ghostsInRow];
                }
            }
            if (x === 6) {
                ghostsStartingPositions = [[i, j], ghostsStartingPositions];
            }
            if (ghostInCell === 6) return 6;
            if (x === 6) return 1;
            return x;
        }
        var val = listFromSlowList(x, convertMapCell);
        return val;
    }

    map = listFromSlowList(map, convertMapRow);
    //map = matrixFromSlowMatrix(map);

    ghostsStartingPositions = listFromSlowList(ghostsStartingPositions, id);

    /*
     * 0: Wall (`#`)
     * 1: Empty (`<space>`)
     * 2: Pill
     * 3: Power pill
     * 4: Fruit location
     * 5: Lambda-Man starting position
     * 6: Ghost starting position
    */
    function canGo(pos) {
        var cell = matrixGet(map, pos);
        if (cell === 1 || cell === 5 || cell === 6) return 127;
        if (cell === 2 || cell === 3 || cell === 4) return 137;
        return -1;
    }

    function bounty(pos, t) {
        var cell = matrixGet(map, pos);
        if (cell === 2)
            return 1e4;
        if (cell === 3) {
            if (lmVitality > t) {
                return 0;
            } else {
                if (fruitStatus > 0) return 5e5;
                return 5e4;
            }
        }
        if (cell === 4 && fruitStatus > 0)
            return 1e6; // TODO: use map size
        return 0;
    }

    var Y = listLength(map);
    var X = listLength(listGet(map, 0));

    function genPath() {
        return -1;
    }
    var paths = genMatrix(X, Y, genPath);

    function genSmell() {
        return 0;
    }
    var smell = genMatrix(X, Y, genSmell);

    function calcPaths() {

        paths = matrixSet(paths, myPos, 0);

        var toDo = 0;
        function prepareGhostsStatuses(ghs) {
            var id = -1;
            function prepareGhostStatus(gh) {
                id = id + 1;
                return [id, [1, gh]]; // new ghost state - 5-tuple (id, time-to-move, standard state...)
                //TODO: track real time-to-move for each ghost!
            }
            return slowListMap(ghostsStatuses, prepareGhostStatus);
        }
        var ghs = prepareGhostsStatuses(ghostsStatuses);
        var myStatus = [lmVitality, 0];
        // (vitality, score)
        // TODO: track ghost eating multiplier!
        var state = [myPos, [ghs, myStatus]];
        toDo = heapPush(toDo, [0, state]);

        while (heapSize(toDo) > 0) {
            var popRes = heapPop(toDo);
            var state = popRes[0];
            var t = state[0];
            state = state[1];
            myPos = state[0];
            state = state[1];
            ghs = state[0]; // ghost statuses
            myStatus = state[1];
            var myVitality = myStatus[0];
            toDo = popRes[1];

            if (t < 127 * 40) {

                var d = 0;
                while (d < 4) {

                    var newPos = shiftDir(myPos, d);
                    var dt = canGo(newPos);

                    if (dt >= 0 && matrixGet(paths, newPos) === -1) {

                        var frighten = 0;
                        var myNewVitality = myVitality;
                        //actually need to save modified map into the state!!
                        if (matrixGet(map, newPos) === 3) {
                            if (!myVitality) {
                                frighten = 1;
                            }
                            myNewVitality = 127 * 20;
                        }

                        var alive = 1;
                        var scoreBonus = 0;

                        function updateGhostStatus(state) {
                            if (module) console.log("gh: ", myPos, myVitality, JSON.stringify(state));

                            var gi = state[0];
                            state = state[1];
                            //FIXME: we actually need a while loop here, ghost can make 2 moves: 130 < 137
                            var gt = state[0];
                            state = state[1];
                            var vit = state[0];
                            state = state[1];
                            var pos = state[0];
                            var d = state[1];

                            if (frighten) {
                                if (module) console.log("frighten!", myPos, newPos);
                                vit = 1;
                                d = oppositeDir(d);
                            } else if (vit && myNewVitality === 0) {
                                vit = 0;
                            }

                            function handleCollision() {
                                if (pos[0] === newPos[0] && pos[1] === newPos[1]) {
                                    if (vit === 0) {
                                        alive = 0;
                                        if (module) console.log("moved on ghost!!", newPos);
                                    } else if (vit === 1) {
                                        pos = listGet(ghostsStartingPositions, gi);
                                        vit = 2;
                                        d = 2;
                                        scoreBonus = scoreBonus + 200000;
                                        if (module) console.log("eated ghost!!", newPos);
                                    }
                                }
                                return 0;
                            }

                            handleCollision();

                            function ghostStrat(d) {
                                d = shiftDir([0,0], d);
                                var dx = d[0];
                                var dy = d[1];
                                var dX = newPos[0] - pos[0];
                                var dY = newPos[1] - pos[1];
                                var tmp;
                                if (dX < 0) {
                                    dX = 0 - dX;
                                    dx = 0 - dx;
                                }
                                if (dY < 0) {
                                    dY = 0 - dY;
                                    dy = 0 - dy;
                                }
                                var s;
                                if (dX < dY) {
                                    if (dy > 0) {
                                        s = 2;
                                    } else if (dx > 0) {
                                        s = 1;
                                    } else if (dx < 0) {
                                        s = -1;
                                    } else {
                                        s = -2;
                                    }
                                }

                                if (vit === 1) {
                                    return 0 - s;
                                } else {
                                    return s;
                                }
                            }

                            function findGhostStrat(ds) {
                                var bestD = 0;
                                var bestScore = -3;
                                while (typeof ds === 'object') {
                                    var d = ds[0];
                                    var val = ghostStrat(d);
                                    if (module) console.log("findGhostStrat:", d, val);
                                    if (val > bestScore || val === bestScore && rand() > 16384) {
                                        bestD = d;
                                        bestScore = val;
                                    }
                                    ds = ds[1];
                                }
                                return bestD;
                            }

                            function handleMove() {

                                var dl = d + 1;
                                if (dl === 4)
                                    dl = 0;
                                var dr = d - 1;
                                if (dl === -1)
                                    dl = 3;
                                var db = oppositeDir(d);

                                if (matrixGet(map, shiftDir(pos, d)) === 0) { // wall
                                    if (matrixGet(map, shiftDir(pos, dl)) === 0) {
                                        if (matrixGet(map, shiftDir(pos, dr)) === 0) {
                                            //  #
                                            // #^#
                                            d = db;
                                        } else {
                                            //  #
                                            // #^.
                                            d = dr;
                                        }
                                    } else {
                                        if (matrixGet(map, shiftDir(pos, dr)) === 0) {
                                            //  #
                                            // .^#
                                            d = dl;
                                        } else {
                                            //  #
                                            // .^.
                                            d = findGhostStrat([dr, [dl, 0]]);
                                        }
                                    }
                                } else {
                                    if (matrixGet(map, shiftDir(pos, dl)) === 0) {
                                        if (matrixGet(map, shiftDir(pos, dr)) === 0) {
                                            //  .
                                            // #^#

                                            // d = d;
                                        } else {
                                            //  .
                                            // #^.
                                            d = findGhostStrat([d, [dr, 0]]);
                                        }
                                    } else {

                                        if (matrixGet(map, shiftDir(pos, dr)) === 0) {
                                            //  .
                                            // .^#
                                            d = findGhostStrat([d, [dl, 0]]);
                                        } else {
                                            //  .
                                            // .^.
                                            d = findGhostStrat([d, [dl, [dr, 0]]]);
                                        }
                                    }
                                }

                                if (module) console.log("ghost move: ", myPos, pos, d);

                                pos = shiftDir(pos, d);
                                handleCollision(); //myVitality - (gt-t) !

                                return 0;
                            }

                            if (gt < t + dt) {
                                handleMove();
                                var gn = gi;
                                while(gn > 4) gn = gn - 4;
                                var gdt;
                                if (vit) { // frightened or invisible
                                    gdt = 195 + (gn * 3);
                                } else {
                                    gdt = 130 + (gn * 2);
                                }
                                gt = gt + gdt;
                            }

                            return [gi, [gt, [vit, [pos, d]]]];
                        }

                        var newGhs = slowListMap(ghs, updateGhostStatus);

                        if (alive) {
                            myNewVitality = myNewVitality - dt;
                            if (myNewVitality < 0)
                                myNewVitality = 0;

                            var myNewStatus = [myNewVitality, 0]; //TODO: score?
                            paths = matrixSet(paths, newPos, t + dt);

                            if (scoreBonus) {
                                smell = matrixSet(smell, newPos, scoreBonus);
                                if (module) console.log("scoreBonus: ", scoreBonus, newPos);
                            }

                            toDo = heapPush(toDo, [t + dt, [newPos, [newGhs, myNewStatus]]]);
                        } else {
                            alive = 1;
                        }

                    } //if canGo

                    d = d + 1;
                } // while d
            }
        }
        return 0;
    }

    function calcSmell() {
        var sortedPaths = flatAndSort(paths);

        while (typeof sortedPaths === 'object') {
            var pos = sortedPaths[0][1];
            var t0 = matrixGet(paths, pos);
            var myVal = matrixGet(smell, pos) + bounty(pos, t0);
            smell = matrixSet(smell, pos, myVal);
            var d = 0;
            while (d < 4) {
                var newPos = shiftDir(pos, d);
                if (canGo(newPos) > 0) {
                    var t = matrixGet(paths, newPos);
                    if (t === t0 - 127 || t === t0 - 137) {
                        var newVal = (myVal * 8 / 10) | 0; // ALPHA
                        if (matrixGet(smell, newPos) < newVal) {
                            smell = matrixSet(smell, newPos, newVal);
                        }
                    }
                }
                d = d + 1;
            }
            sortedPaths = sortedPaths[1];
        }
        return 0;
    }

    var myPos = lmStatus(1);
    var myOrigPos = myPos;
    calcPaths();
    calcSmell();

    var d = 0,
        bestSmell = -1,
        bestD = 0;
    while (d < 4) {
        var val = matrixGet(smell, shiftDir(myOrigPos, d));
        if (val > bestSmell || val === bestSmell && mod(rand(), 2)) {
            bestSmell = val;
            bestD = d;
            //console.log(bestD);
            //console.log(bestSmell);
        }
        d = d + 1;
    }

    return [[paths, [smell, map]], bestD];
}

if (module) { // Node.js
    function nodejsMain() {
        function toHtml(map, mx) {
            var _map = [];
            function mapIterate(cell, i, j) {
                (_map[i] || (_map[i] = []))[j] = cell;
            }
            matrixIterate(map, mapIterate);

            var _mx = [];
            function mxIterate(v, i, j) {
                (_mx[i] || (_mx[i] = []))[j] = v;
            }
            matrixIterate(mx, mxIterate);

            var res = '<table border="1" cellspacing="0" cellpadding="0">';
            for(var i = 0; i < _map.length; i++) {
                var mapRow = _map[i] || [],
                    row = _mx[i] || [];
                res += '<tr>';
                for(var j = 0; j < mapRow.length; j++) {
                    res += '<td>' +
                        ({ '0': '#', '1': ' ', '2': '.', '3': 'o', '4': '%', '5': '\\', '6': '=' }[mapRow[j]]) +
                        '<sup>' + (typeof row[j] === 'undefined' ? '' : row[j]) + '</sup>' +
                        '</td>';
                }
                res += '</tr>';
            }
            return res += '</table>'
        }

        function readMap(mapFile) {
            function contentToArray(str) {
                return str.replace(/\n$/, '').split('\n');
            }

            var mapContent = FS.readFileSync(mapFile, 'utf8').split('\n--\n'),
                lmVitality = 0,
                lmPos,
                lmDirection = 2,
                lmLives = 3,
                lmScore = 0,
                ghostsContent = mapContent[1] ? contentToArray(mapContent[1]) : [],
                ghostsCount = 0,
                ghostsStatuses = 0,
                fruitStatus = mapContent[2] ? parseInt(mapContent[2], 10) : 0;
                map = contentToArray(mapContent[0]).reduceRight(function(a, x, j) {
                    x = x.split("").reduceRight(function(b, y, i) {
                        if(y === '\\') {
                            lmPos = [i, j];
                        } else if(y === '=') {
                            var ghostContent = ghostsContent[ghostsCount] || '0 2',
                                ghostVitality = parseInt(ghostContent[0], 10),
                                ghostDirection = parseInt(ghostContent[2], 10);
                            ghostsStatuses = [[ghostVitality, [[i, j], ghostDirection]], ghostsStatuses];
                            ghostsCount = ghostsCount + 1;
                        }
                        return [{ '#': 0, ' ': 1, '.': 2, 'o': 3, '%': 4, '\\': 1, '=': 6 }[y], b];
                    }, 0);
                    return [x, a];
                }, 0);

            var lmStatus = [lmVitality, [lmPos, [lmDirection, [lmLives, lmScore]]]];

            return [map, [lmStatus, [ghostsStatuses, fruitStatus]]];
        }

        var FS = require('fs'),
            worldState = readMap('map3.txt'),
            res = step(0, worldState);

        console.log("res: ", JSON.stringify(res));
        res = tplGetter(res[0], 3);
        FS.writeFileSync('map.html',
            toHtml(res(2), res(0)) +
            '<br/>' +
            toHtml(res(2), res(1)) +
            '<br/>' + res[1]);
    }

    nodejsMain();
}

[0, step];
