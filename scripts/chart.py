"""On-brand charts for blog posts (black, greys and one red), saved as small SVG files.

Usage from a post-writing script:

    import sys; sys.path.insert(0, 'scripts')
    from chart import bar, line
    bar('public/images/blog/<slug>/sensor-sizes.svg',
        labels=['Super 35', 'Full frame', 'LF'], values=[24.9, 36, 36.7],
        unit='mm wide', highlight='Full frame', title='Sensor width')

Then in the post:  ![Sensor width by format](/images/blog/<slug>/sensor-sizes.svg)
                   *Sensor width in mm. Source: manufacturer specs.*

Only chart numbers you can source; put the source in the caption.
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

INK, MUTED, LINE, RED = "#000000", "#6b6b70", "#e2e0dc", "#ff0000"
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 11,
    "svg.fonttype": "path",
    "axes.edgecolor": LINE,
    "axes.labelcolor": MUTED,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "axes.spines.top": False,
    "axes.spines.right": False,
})


def _finish(fig, ax, path, title):
    if title:
        ax.set_title(title, loc="left", fontsize=13, fontweight="bold", color=INK, pad=14)
    fig.tight_layout()
    fig.savefig(path, format="svg", transparent=False, facecolor="white")
    plt.close(fig)


def bar(path, labels, values, unit="", highlight=None, title=None, horizontal=True, fmt="{:g}"):
    """Bars in grey, the one that matters in red. Values printed on the bars."""
    n = len(labels)
    fig, ax = plt.subplots(figsize=(8, 0.55 * n + 1.3) if horizontal else (8, 4.2))
    colors = [RED if l == highlight else "#bdbdc2" for l in labels]
    if horizontal:
        bars = ax.barh(labels[::-1], values[::-1], color=colors[::-1], height=0.6)
        ax.xaxis.set_visible(False)
        ax.spines["bottom"].set_visible(False)
        ax.tick_params(axis="y", length=0, labelsize=11, labelcolor=INK)
        for b, v in zip(bars, values[::-1]):
            ax.text(b.get_width(), b.get_y() + b.get_height() / 2, f"  {fmt.format(v)} {unit}".rstrip(),
                    va="center", color=INK, fontsize=10)
        ax.set_xlim(0, max(values) * 1.25)
    else:
        bars = ax.bar(labels, values, color=colors, width=0.6)
        ax.yaxis.set_visible(False)
        ax.spines["left"].set_visible(False)
        ax.tick_params(axis="x", length=0, labelcolor=INK)
        for b, v in zip(bars, values):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height(), f"{fmt.format(v)} {unit}".strip(),
                    ha="center", va="bottom", color=INK, fontsize=10)
        ax.set_ylim(0, max(values) * 1.18)
    _finish(fig, ax, path, title)


def line(path, x, series, xlabel="", ylabel="", title=None, highlight=None):
    """series: {name: [y values]}. The highlighted series is red, others grey; names label the line ends."""
    fig, ax = plt.subplots(figsize=(8, 4.2))
    for name, ys in series.items():
        c = RED if name == highlight or len(series) == 1 else "#9a9aa0"
        ax.plot(x, ys, color=c, linewidth=2.4 if c == RED else 1.6)
        ax.text(x[-1], ys[-1], f"  {name}", va="center", color=c if c == RED else MUTED, fontsize=10)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(axis="y", color=LINE, linewidth=0.8)
    ax.set_axisbelow(True)
    _finish(fig, ax, path, title)
