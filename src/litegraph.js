import { LiteGraphGlobal } from "./LiteGraphGlobal";
import { LGraph } from "./LGraph"
import { LLink } from "./LLink"
import { LGraphNode } from "./LGraphNode";
import { LGraphGroup } from "./LGraphGroup";
import { DragAndScale } from "./DragAndScale";
import { LGraphCanvas } from "./LGraphCanvas";

export { LGraph, LLink, LGraphNode, LGraphGroup, DragAndScale, LGraphCanvas }

export const LiteGraph = new LiteGraphGlobal()

    LiteGraph.LGraph = LGraph

    LiteGraph.LLink = LLink;

    LiteGraph.LGraphNode = LGraphNode;

    LGraphGroup.prototype.isPointInside = LGraphNode.prototype.isPointInside;
    LGraphGroup.prototype.setDirtyCanvas = LGraphNode.prototype.setDirtyCanvas;

    LiteGraph.LGraphGroup = LGraphGroup;

    LiteGraph.DragAndScale = DragAndScale;

    LiteGraph.LGraphCanvas = LGraphCanvas;
    //API *************************************************
    //like rect but rounded corners
    if (typeof(window) != "undefined" && window.CanvasRenderingContext2D && !window.CanvasRenderingContext2D.prototype.roundRect) {
        window.CanvasRenderingContext2D.prototype.roundRect = function(
		x,
		y,
		w,
		h,
		radius,
		radius_low
	) {
		var top_left_radius = 0;
		var top_right_radius = 0;
		var bottom_left_radius = 0;
		var bottom_right_radius = 0;

		if ( radius === 0 )
		{
			this.rect(x,y,w,h);
			return;
		}

		if(radius_low === undefined)
			radius_low = radius;

		//make it compatible with official one
		if(radius != null && radius.constructor === Array)
		{
			if(radius.length == 1)
				top_left_radius = top_right_radius = bottom_left_radius = bottom_right_radius = radius[0];
			else if(radius.length == 2)
			{
				top_left_radius = bottom_right_radius = radius[0];
				top_right_radius = bottom_left_radius = radius[1];
			}
			else if(radius.length == 4)
			{
				top_left_radius = radius[0];
				top_right_radius = radius[1];
				bottom_left_radius = radius[2];
				bottom_right_radius = radius[3];
			}
			else
				return;
		}
		else //old using numbers
		{
			top_left_radius = radius || 0;
			top_right_radius = radius || 0;
			bottom_left_radius = radius_low || 0;
			bottom_right_radius = radius_low || 0;
		}

		//top right
		this.moveTo(x + top_left_radius, y);
		this.lineTo(x + w - top_right_radius, y);
		this.quadraticCurveTo(x + w, y, x + w, y + top_right_radius);

		//bottom right
		this.lineTo(x + w, y + h - bottom_right_radius);
		this.quadraticCurveTo(
			x + w,
			y + h,
			x + w - bottom_right_radius,
			y + h
		);

		//bottom left
		this.lineTo(x + bottom_right_radius, y + h);
		this.quadraticCurveTo(x, y + h, x, y + h - bottom_left_radius);

		//top left
		this.lineTo(x, y + bottom_left_radius);
		this.quadraticCurveTo(x, y, x + top_left_radius, y);
	};
	}//if

    /* LiteGraph GUI elements used for canvas editing *************************************/

    /**
     * ContextMenu from LiteGUI
     *
     * @class ContextMenu
     * @constructor
     * @param {Array} values (allows object { title: "Nice text", callback: function ... })
     * @param {Object} options [optional] Some options:\
     * - title: title to show on top of the menu
     * - callback: function to call when an option is clicked, it receives the item information
     * - ignore_item_callbacks: ignores the callback inside the item, it just calls the options.callback
     * - event: you can pass a MouseEvent, this way the ContextMenu appears in that position
     */
    export class ContextMenu {
        constructor(values, options) {
        options = options || {};
        this.options = options;
        var that = this;

        //to link a menu with its parent
        if (options.parentMenu) {
            if (!(options.parentMenu instanceof ContextMenu)) {
                console.error(
                    "parentMenu must be of class ContextMenu, ignoring it"
                );
                options.parentMenu = null;
            } else {
                this.parentMenu = options.parentMenu;
                this.parentMenu.lock = true;
                this.parentMenu.current_submenu = this;
            }
            if (options.parentMenu.options?.className === "dark") {
                options.className = "dark"
            }
        }

        var eventClass = null;
        if (options.event) //use strings because comparing classes between windows doesnt work
            eventClass = options.event.constructor.name;
        if (eventClass !== "MouseEvent" &&
            eventClass !== "CustomEvent" &&
            eventClass !== "PointerEvent") {
            console.error(
                "Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (" + eventClass + ")"
            );
            options.event = null;
        }

        var root = document.createElement("div");
        root.className = "litegraph litecontextmenu litemenubar-panel";
        if (options.className) {
            root.className += " " + options.className;
        }
        root.style.minWidth = 100;
        root.style.minHeight = 100;
        root.style.pointerEvents = "none";
        setTimeout(function () {
            root.style.pointerEvents = "auto";
        }, 100); //delay so the mouse up event is not caught by this element


        //this prevents the default context browser menu to open in case this menu was created when pressing right button
        LiteGraph.pointerListenerAdd(root, "up",
            function (e) {
                //console.log("pointerevents: ContextMenu up root prevent");
                e.preventDefault();
                return true;
            },
            true
        );
        root.addEventListener(
            "contextmenu",
            function (e) {
                if (e.button != 2) {
                    //right button
                    return false;
                }
                e.preventDefault();
                return false;
            },
            true
        );

        LiteGraph.pointerListenerAdd(root, "down",
            function (e) {
                //console.log("pointerevents: ContextMenu down");
                if (e.button == 2) {
                    that.close();
                    e.preventDefault();
                    return true;
                }
            },
            true
        );

        function on_mouse_wheel(e) {
            var pos = parseInt(root.style.top);
            root.style.top =
                (pos + e.deltaY * options.scroll_speed).toFixed() + "px";
            e.preventDefault();
            return true;
        }

        if (!options.scroll_speed) {
            options.scroll_speed = 0.1;
        }

        root.addEventListener("wheel", on_mouse_wheel, true);
        root.addEventListener("mousewheel", on_mouse_wheel, true);

        this.root = root;

        //title
        if (options.title) {
            var element = document.createElement("div");
            element.className = "litemenu-title";
            element.innerHTML = options.title;
            root.appendChild(element);
        }

        //entries
        var num = 0;
        for (var i = 0; i < values.length; i++) {
            var name = values.constructor == Array ? values[i] : i;
            if (name != null && name.constructor !== String) {
                name = name.content === undefined ? String(name) : name.content;
            }
            var value = values[i];
            this.addItem(name, value, options);
            num++;
        }

        //close on leave? touch enabled devices won't work TODO use a global device detector and condition on that
        /*LiteGraph.pointerListenerAdd(root,"leave", function(e) {
            console.log("pointerevents: ContextMenu leave");
            if (that.lock) {
                return;
            }
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
            root.closing_timer = setTimeout(that.close.bind(that, e), 500);
            //that.close(e);
        });*/
        LiteGraph.pointerListenerAdd(root, "enter", function (e) {
            //console.log("pointerevents: ContextMenu enter");
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
        });

        //insert before checking position
        var root_document = document;
        if (options.event) {
            root_document = options.event.target.ownerDocument;
        }

        if (!root_document) {
            root_document = document;
        }

        if (root_document.fullscreenElement)
            root_document.fullscreenElement.appendChild(root);

        else
            root_document.body.appendChild(root);

        //compute best position
        var left = options.left || 0;
        var top = options.top || 0;
        if (options.event) {
            left = options.event.clientX - 10;
            top = options.event.clientY - 10;
            if (options.title) {
                top -= 20;
            }

            if (options.parentMenu) {
                var rect = options.parentMenu.root.getBoundingClientRect();
                left = rect.left + rect.width;
            }

            var body_rect = document.body.getBoundingClientRect();
            var root_rect = root.getBoundingClientRect();
            if (body_rect.height == 0)
                console.error("document.body height is 0. That is dangerous, set html,body { height: 100%; }");

            if (body_rect.width && left > body_rect.width - root_rect.width - 10) {
                left = body_rect.width - root_rect.width - 10;
            }
            if (body_rect.height && top > body_rect.height - root_rect.height - 10) {
                top = body_rect.height - root_rect.height - 10;
            }
        }

        root.style.left = left + "px";
        root.style.top = top + "px";

        if (options.scale) {
            root.style.transform = "scale(" + options.scale + ")";
        }
    }

    addItem(name, value, options) {
        var that = this;
        options = options || {};

        var element = document.createElement("div");
        element.className = "litemenu-entry submenu";

        var disabled = false;

        if (value === null) {
            element.classList.add("separator");
            //element.innerHTML = "<hr/>"
            //continue;
        } else {
            element.innerHTML = value && value.title ? value.title : name;
            element.value = value;
            element.setAttribute("role", "menuitem");

            if (value) {
                if (value.disabled) {
                    disabled = true;
                    element.classList.add("disabled");
                    element.setAttribute("aria-disabled", "true");
                }
                if (value.submenu || value.has_submenu) {
                    element.classList.add("has_submenu");
                    element.setAttribute("aria-haspopup", "true");
                    element.setAttribute("aria-expanded", "false");
                }
            }

            if (typeof value == "function") {
                element.dataset["value"] = name;
                element.onclick_callback = value;
            } else {
                element.dataset["value"] = value;
            }

            if (value.className) {
                element.className += " " + value.className;
            }
        }

        this.root.appendChild(element);
        if (!disabled) {
            element.addEventListener("click", inner_onclick);
        }
        if (!disabled && options.autoopen) {
            LiteGraph.pointerListenerAdd(element, "enter", inner_over);
        }

        function setAriaExpanded() {
            const entries = that.root.querySelectorAll("div.litemenu-entry.has_submenu");
            if (entries) {
                for (let i = 0; i < entries.length; i++) {
                    entries[i].setAttribute("aria-expanded", "false");
                }
            }
            element.setAttribute("aria-expanded", "true");
        }

        function inner_over(e) {
            var value = this.value;
            if (!value || !value.has_submenu) {
                return;
            }
            //if it is a submenu, autoopen like the item was clicked
            inner_onclick.call(this, e);
            setAriaExpanded();
        }

        //menu option clicked
        function inner_onclick(e) {
            var value = this.value;
            var close_parent = true;

            if (that.current_submenu) {
                that.current_submenu.close(e);
            }
            if (value?.has_submenu || value?.submenu) {
                setAriaExpanded();
            }

            //global callback
            if (options.callback) {
                var r = options.callback.call(
                    this,
                    value,
                    options,
                    e,
                    that,
                    options.node
                );
                if (r === true) {
                    close_parent = false;
                }
            }

            //special cases
            if (value) {
                if (value.callback &&
                    !options.ignore_item_callbacks &&
                    value.disabled !== true) {
                    //item callback
                    var r = value.callback.call(
                        this,
                        value,
                        options,
                        e,
                        that,
                        options.extra
                    );
                    if (r === true) {
                        close_parent = false;
                    }
                }
                if (value.submenu) {
                    if (!value.submenu.options) {
                        throw "ContextMenu submenu needs options";
                    }
                    var submenu = new that.constructor(value.submenu.options, {
                        callback: value.submenu.callback,
                        event: e,
                        parentMenu: that,
                        ignore_item_callbacks: value.submenu.ignore_item_callbacks,
                        title: value.submenu.title,
                        extra: value.submenu.extra,
                        autoopen: options.autoopen
                    });
                    close_parent = false;
                }
            }

            if (close_parent && !that.lock) {
                that.close();
            }
        }

        return element;
    }

    close(e, ignore_parent_menu) {
        if (this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
        if (this.parentMenu && !ignore_parent_menu) {
            this.parentMenu.lock = false;
            this.parentMenu.current_submenu = null;
            if (e === undefined) {
                this.parentMenu.close();
            } else if (e &&
                !ContextMenu.isCursorOverElement(e, this.parentMenu.root)) {
                ContextMenu.trigger(this.parentMenu.root, LiteGraph.pointerevents_method + "leave", e);
            }
        }
        if (this.current_submenu) {
            this.current_submenu.close(e, true);
        }

        if (this.root.closing_timer) {
            clearTimeout(this.root.closing_timer);
        }

        // TODO implement : LiteGraph.contextMenuClosed(); :: keep track of opened / closed / current ContextMenu
        // on key press, allow filtering/selecting the context menu elements
    }

    //this code is used to trigger events easily (used in the context menu mouseleave
    static trigger(element, event_name, params, origin) {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent(event_name, true, true, params); //canBubble, cancelable, detail
        evt.srcElement = origin;
        if (element.dispatchEvent) {
            element.dispatchEvent(evt);
        } else if (element.__events) {
            element.__events.dispatchEvent(evt);
        }
        //else nothing seems binded here so nothing to do
        return evt;
    }

    //returns the top most menu
    getTopMenu() {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getTopMenu();
        }
        return this;
    }

    getFirstEvent() {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getFirstEvent();
        }
        return this.options.event;
    }

    static isCursorOverElement(event, element) {
        var left = event.clientX;
        var top = event.clientY;
        var rect = element.getBoundingClientRect();
        if (!rect) {
            return false;
        }
        if (
            top > rect.top &&
            top < rect.top + rect.height &&
            left > rect.left &&
            left < rect.left + rect.width
        ) {
            return true;
        }
        return false;
    }
    }

    LiteGraph.ContextMenu = ContextMenu;

    LiteGraph.closeAllContextMenus = function(ref_window) {
        ref_window = ref_window || window;

        var elements = ref_window.document.querySelectorAll(".litecontextmenu");
        if (!elements.length) {
            return;
        }

        var result = [];
        for (var i = 0; i < elements.length; i++) {
            result.push(elements[i]);
        }

        for (var i=0; i < result.length; i++) {
            if (result[i].close) {
                result[i].close();
            } else if (result[i].parentNode) {
                result[i].parentNode.removeChild(result[i]);
            }
        }
    };

    LiteGraph.extendClass = function(target, origin) {
        for (var i in origin) {
            //copy class properties
            if (target.hasOwnProperty(i)) {
                continue;
            }
            target[i] = origin[i];
        }

        if (origin.prototype) {
            //copy prototype properties
            for (var i in origin.prototype) {
                //only enumerable
                if (!origin.prototype.hasOwnProperty(i)) {
                    continue;
                }

                if (target.prototype.hasOwnProperty(i)) {
                    //avoid overwriting existing ones
                    continue;
                }

                //copy getters
                if (origin.prototype.__lookupGetter__(i)) {
                    target.prototype.__defineGetter__(
                        i,
                        origin.prototype.__lookupGetter__(i)
                    );
                } else {
                    target.prototype[i] = origin.prototype[i];
                }

                //and setters
                if (origin.prototype.__lookupSetter__(i)) {
                    target.prototype.__defineSetter__(
                        i,
                        origin.prototype.__lookupSetter__(i)
                    );
                }
            }
        }
    };

	//used by some widgets to render a curve editor
	export class CurveEditor {
        constructor(points) {
            this.points = points;
            this.selected = -1;
            this.nearest = -1;
            this.size = null; //stores last size used
            this.must_update = true;
            this.margin = 5;
        }

        static sampleCurve(f, points) {
            if (!points)
                return;
            for (var i = 0; i < points.length - 1; ++i) {
                var p = points[i];
                var pn = points[i + 1];
                if (pn[0] < f)
                    continue;
                var r = (pn[0] - p[0]);
                if (Math.abs(r) < 0.00001)
                    return p[1];
                var local_f = (f - p[0]) / r;
                return p[1] * (1.0 - local_f) + pn[1] * local_f;
            }
            return 0;
        }

        draw(ctx, size, graphcanvas, background_color, line_color, inactive) {
            var points = this.points;
            if (!points)
                return;
            this.size = size;
            var w = size[0] - this.margin * 2;
            var h = size[1] - this.margin * 2;

            line_color = line_color || "#666";

            ctx.save();
            ctx.translate(this.margin, this.margin);

            if (background_color) {
                ctx.fillStyle = "#111";
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = "#222";
                ctx.fillRect(w * 0.5, 0, 1, h);
                ctx.strokeStyle = "#333";
                ctx.strokeRect(0, 0, w, h);
            }
            ctx.strokeStyle = line_color;
            if (inactive)
                ctx.globalAlpha = 0.5;
            ctx.beginPath();
            for (var i = 0; i < points.length; ++i) {
                var p = points[i];
                ctx.lineTo(p[0] * w, (1.0 - p[1]) * h);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            if (!inactive)
                for (var i = 0; i < points.length; ++i) {
                    var p = points[i];
                    ctx.fillStyle = this.selected == i ? "#FFF" : (this.nearest == i ? "#DDD" : "#AAA");
                    ctx.beginPath();
                    ctx.arc(p[0] * w, (1.0 - p[1]) * h, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            ctx.restore();
        }

        //localpos is mouse in curve editor space
        onMouseDown(localpos, graphcanvas) {
            var points = this.points;
            if (!points)
                return;
            if (localpos[1] < 0)
                return;

            //this.captureInput(true);
            var w = this.size[0] - this.margin * 2;
            var h = this.size[1] - this.margin * 2;
            var x = localpos[0] - this.margin;
            var y = localpos[1] - this.margin;
            var pos = [x, y];
            var max_dist = 30 / graphcanvas.ds.scale;
            //search closer one
            this.selected = this.getCloserPoint(pos, max_dist);
            //create one
            if (this.selected == -1) {
                var point = [x / w, 1 - y / h];
                points.push(point);
                points.sort(function (a, b) { return a[0] - b[0]; });
                this.selected = points.indexOf(point);
                this.must_update = true;
            }
            if (this.selected != -1)
                return true;
        }

        onMouseMove(localpos, graphcanvas) {
            var points = this.points;
            if (!points)
                return;
            var s = this.selected;
            if (s < 0)
                return;
            var x = (localpos[0] - this.margin) / (this.size[0] - this.margin * 2);
            var y = (localpos[1] - this.margin) / (this.size[1] - this.margin * 2);
            var curvepos = [(localpos[0] - this.margin), (localpos[1] - this.margin)];
            var max_dist = 30 / graphcanvas.ds.scale;
            this._nearest = this.getCloserPoint(curvepos, max_dist);
            var point = points[s];
            if (point) {
                var is_edge_point = s == 0 || s == points.length - 1;
                if (!is_edge_point && (localpos[0] < -10 || localpos[0] > this.size[0] + 10 || localpos[1] < -10 || localpos[1] > this.size[1] + 10)) {
                    points.splice(s, 1);
                    this.selected = -1;
                    return;
                }
                if (!is_edge_point) //not edges
                    point[0] = clamp(x, 0, 1);

                else
                    point[0] = s == 0 ? 0 : 1;
                point[1] = 1.0 - clamp(y, 0, 1);
                points.sort(function (a, b) { return a[0] - b[0]; });
                this.selected = points.indexOf(point);
                this.must_update = true;
            }
        }

        onMouseUp(localpos, graphcanvas) {
            this.selected = -1;
            return false;
        }

        getCloserPoint(pos, max_dist) {
            var points = this.points;
            if (!points)
                return -1;
            max_dist = max_dist || 30;
            var w = (this.size[0] - this.margin * 2);
            var h = (this.size[1] - this.margin * 2);
            var num = points.length;
            var p2 = [0, 0];
            var min_dist = 1000000;
            var closest = -1;
            var last_valid = -1;
            for (var i = 0; i < num; ++i) {
                var p = points[i];
                p2[0] = p[0] * w;
                p2[1] = (1.0 - p[1]) * h;
                if (p2[0] < pos[0])
                    last_valid = i;
                var dist = vec2.distance(pos, p2);
                if (dist > min_dist || dist > max_dist)
                    continue;
                closest = i;
                min_dist = dist;
            }
            return closest;
        }
    }

    LiteGraph.CurveEditor = CurveEditor;

    export function clamp(v, a, b) {
        return a > v ? a : b < v ? b : v;
    };

    if (typeof window != "undefined" && !window["requestAnimationFrame"]) {
        window.requestAnimationFrame =
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    }

export { LGraphBadge, BadgePosition } from "./LGraphBadge"
