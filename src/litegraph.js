import { LiteGraphGlobal } from "./LiteGraphGlobal";
import { LGraph } from "./LGraph"
import { LLink } from "./LLink"
import { LGraphNode } from "./LGraphNode";
import { LGraphGroup } from "./LGraphGroup";
import { DragAndScale } from "./DragAndScale";
import { LGraphCanvas } from "./LGraphCanvas";
import { ContextMenu } from "./ContextMenu";

export { LGraph, LLink, LGraphNode, LGraphGroup, DragAndScale, LGraphCanvas, ContextMenu }

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
