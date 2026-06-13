#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Erzeugt die Kennlinien-Bilder fuer das virtuelle DASM-Labor.
Verwendet das Gamma-Ersatzschaltbild einer 1,5-kW-Asynchronmaschine.
Dasselbe Modell steckt (in JavaScript portiert) im Live-Labor -> konsistente Werte.
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

# ----------------------------------------------------------------------
# Farbpalette (identisch zum Web-Frontend)
# ----------------------------------------------------------------------
PAPIER   = "#ffffff"
TINTE    = "#0f1419"
STAHL    = "#5b6b7a"
GITTER   = "#d4dae0"
SPANNUNG = "#1452f0"   # Primaer / elektrisches Blau
WARNUNG  = "#e0561b"   # Kipppunkt / Achtung
MESSWERT = "#1f9d55"   # Gruen
VIOLETT  = "#7c3aed"

plt.rcParams.update({
    "figure.facecolor": PAPIER,
    "axes.facecolor": PAPIER,
    "savefig.facecolor": PAPIER,
    "font.family": "DejaVu Sans",
    "font.size": 12.5,
    "axes.edgecolor": STAHL,
    "axes.labelcolor": TINTE,
    "axes.linewidth": 1.1,
    "xtick.color": STAHL,
    "ytick.color": STAHL,
    "text.color": TINTE,
    "axes.grid": True,
    "grid.color": GITTER,
    "grid.linewidth": 0.9,
    "grid.alpha": 1.0,
})

# ----------------------------------------------------------------------
# Maschinenparameter (Gamma-Ersatzschaltbild, je Strang, Stern 230 V)
# ----------------------------------------------------------------------
U   = 230.0      # Strangspannung [V]
f   = 50.0       # Netzfrequenz [Hz]
p   = 2          # Polpaarzahl  -> n_s = 1500 1/min
R1  = 5.0        # Staenderwiderstand [Ohm]
R2  = 4.5        # auf Staender bezogener Laeuferwiderstand [Ohm]
X   = 15.0       # Gesamtstreureaktanz X1+X2' [Ohm]
Xh  = 150.0      # Hauptreaktanz [Ohm]
RFe = 3527.0     # Eisenverlustwiderstand [Ohm]
MR  = 0.25       # Reibungs-/Lueftungsmoment [Nm]

n_s     = 60.0 * f / p              # synchrone Drehzahl 1/min
omega_s = 2.0 * np.pi * n_s / 60.0  # synchrone Winkelgeschw. [rad/s]

def schlupf_zu_drehzahl(s):
    return n_s * (1.0 - s)

def betriebsgroessen(s):
    """Liefert ein dict mit allen Groessen fuer gegebenen Schlupf s (0<s<=1)."""
    s = np.maximum(s, 1e-4)
    Zr = (R1 + R2 / s) + 1j * X          # Laeuferzweig
    I2 = U / Zr                           # bezogener Laeuferstrom (komplex)
    Im = U / (1j * Xh)                    # Magnetisierungsstrom
    IFe = U / RFe                         # Eisenverluststrom
    I1 = I2 + Im + IFe                    # Staenderstrom
    I2b = np.abs(I2)
    I1b = np.abs(I1)
    cosphi = np.real(I1) / I1b

    P_zu  = 3.0 * U * np.real(I1)         # aufgenommene Wirkleistung
    P_d   = 3.0 * I2b**2 * (R2 / s)       # Luftspaltleistung
    M     = P_d / omega_s                 # Luftspalt-/inneres Drehmoment
    P_cu1 = 3.0 * I2b**2 * R1
    P_cu2 = s * P_d
    P_fe  = (3.0 * U**2 / RFe) * np.ones_like(I2b)
    P_mi  = (1.0 - s) * P_d               # inn. mech. Leistung
    omega = (1.0 - s) * omega_s
    P_reib = MR * omega
    P_ab  = P_mi - P_reib                 # Wellenleistung
    M_w   = np.where(omega > 1e-6, P_ab / np.maximum(omega, 1e-6), 0.0)  # Wellenmoment
    eta   = np.where(P_zu > 1e-6, P_ab / P_zu, 0.0)
    return dict(s=s, n=schlupf_zu_drehzahl(s), I1=I1b, I2=I2b, cosphi=cosphi,
                P_zu=P_zu, P_ab=P_ab, P_d=P_d, M=M, M_w=M_w, eta=eta,
                P_cu1=P_cu1, P_cu2=P_cu2, P_fe=P_fe, P_reib=P_reib)

# Kennwerte
s_K = R2 / np.sqrt(R1**2 + X**2)
M_K = 3.0 * U**2 / (2.0 * omega_s * (R1 + np.sqrt(R1**2 + X**2)))
g_start = betriebsgroessen(np.array([1.0]))
M_A = float(g_start["M"][0])
I_A = float(g_start["I1"][0])

# Nennpunkt (s_N = 0.053)
s_N = 0.053
gN = betriebsgroessen(np.array([s_N]))
M_N = float(gN["M_w"][0]); I_N = float(gN["I1"][0]); P_N = float(gN["P_ab"][0])
eta_N = float(gN["eta"][0]); cos_N = float(gN["cosphi"][0]); n_N = float(gN["n"][0])

print("=== Kennwerte der Modellmaschine ===")
print(f"n_s   = {n_s:.0f} 1/min   omega_s = {omega_s:.2f} rad/s")
print(f"s_K   = {s_K:.3f}   ->  n_K = {schlupf_zu_drehzahl(s_K):.0f} 1/min")
print(f"M_K   = {M_K:.2f} Nm   M_A = {M_A:.2f} Nm   I_A = {I_A:.2f} A")
print(f"Nenn: n_N={n_N:.0f}  M_N={M_N:.2f}Nm  P_N={P_N:.0f}W  I_N={I_N:.2f}A  "
      f"cos={cos_N:.3f}  eta={eta_N*100:.1f}%  M_K/M_N={M_K/M_N:.2f}")

# Wertebereiche
s_voll = np.linspace(1.0, 1e-4, 1200)        # s = 1 .. 0
g = betriebsgroessen(s_voll)
n = g["n"]

# ----------------------------------------------------------------------
# BILD 1 : Drehmoment-Drehzahl-Kennlinie  M = f(n)
# ----------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=130)
ax.plot(n, g["M"], color=SPANNUNG, lw=3.0, solid_capstyle="round", zorder=5,
        label="Drehmoment $M(n)$")

# Markante Punkte
n_K = schlupf_zu_drehzahl(s_K)
ax.scatter([n_K], [M_K], s=95, color=WARNUNG, zorder=7, edgecolor="white", linewidth=1.6)
ax.annotate(f"Kippmoment $M_K$ = {M_K:.1f} Nm\nbei $n_K$ = {n_K:.0f} 1/min  ($s_K$ = {s_K:.2f})",
            (n_K, M_K), xytext=(n_K+90, M_K+1.5), fontsize=11.5, color=WARNUNG,
            fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=WARNUNG, lw=1.4))
ax.scatter([0], [M_A], s=70, color=TINTE, zorder=7, edgecolor="white", linewidth=1.4)
ax.annotate(f"Anlaufmoment\n$M_A$ = {M_A:.1f} Nm", (0, M_A), xytext=(150, M_A-3.2),
            fontsize=10.5, color=TINTE,
            arrowprops=dict(arrowstyle="-", color=TINTE, lw=1.2))
ax.scatter([n_N], [M_N], s=85, color=MESSWERT, zorder=7, edgecolor="white", linewidth=1.6)
ax.annotate(f"Nennpunkt $M_N$ = {M_N:.1f} Nm", (n_N, M_N), xytext=(n_N-560, M_N+2.4),
            fontsize=10.8, color=MESSWERT, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=MESSWERT, lw=1.3))
ax.axvline(n_s, color=STAHL, ls=(0, (5, 4)), lw=1.4)
ax.annotate(f"$n_s$ = {n_s:.0f} 1/min\n(synchron, $s$=0, $M$=0)", (n_s, M_K*0.62),
            xytext=(n_s-70, M_K*0.55), fontsize=10, color=STAHL, ha="right")

# Stabiler Arbeitsbereich schattieren
mask_stab = n >= n_K
ax.fill_between(n[mask_stab], 0, g["M"][mask_stab], color=SPANNUNG, alpha=0.07, zorder=1)
ax.text(0.5*(n_K+n_s), 1.0, "stabiler\nArbeitsbereich", fontsize=9.5, color=SPANNUNG,
        ha="center", va="bottom", alpha=0.85)

ax.set_xlim(-30, n_s+90); ax.set_ylim(0, M_K*1.18)
ax.set_xlabel("Drehzahl  $n$  in  1/min")
ax.set_ylabel("Drehmoment  $M$  in  Nm")
ax.set_title("Drehmoment-Drehzahl-Kennlinie der Drehstrom-Asynchronmaschine",
             fontsize=14, fontweight="bold", pad=12, color=TINTE)
ax.legend(loc="upper left", frameon=True, framealpha=0.95, edgecolor=GITTER)
fig.tight_layout()
fig.savefig("bilder/kennlinie_drehmoment.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# BILD 2 : Belastungskennlinie  n = f(M)  (nur stabiler Ast)
# ----------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=130)
mask = n >= n_K
Mv = g["M"][mask]; nv = n[mask]
ax.plot(Mv, nv, color=SPANNUNG, lw=3.0, solid_capstyle="round", zorder=5)
ax.scatter([0], [n_s], s=70, color=STAHL, zorder=6, edgecolor="white", linewidth=1.4)
ax.annotate(f"Leerlauf  $n_0 \\approx n_s$ = {n_s:.0f}", (0, n_s),
            xytext=(M_N*0.7, n_s-18), fontsize=10.5, color=STAHL)
ax.scatter([M_N], [n_N], s=85, color=MESSWERT, zorder=6, edgecolor="white", linewidth=1.6)
ax.annotate(f"Nennpunkt\n$M_N$={M_N:.1f} Nm,  $n_N$={n_N:.0f}", (M_N, n_N),
            xytext=(M_N+1.2, n_N+12), fontsize=10.8, color=MESSWERT, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=MESSWERT, lw=1.3))
ax.scatter([M_K], [n_K], s=95, color=WARNUNG, zorder=6, edgecolor="white", linewidth=1.6)
ax.annotate(f"Kipppunkt\n$M_K$={M_K:.1f} Nm,  $n_K$={n_K:.0f}", (M_K, n_K),
            xytext=(M_K-5.5, n_K-55), fontsize=10.8, color=WARNUNG, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=WARNUNG, lw=1.3))
ax.annotate("", xy=(M_K, n_K-30), xytext=(0.5, n_K-30),
            arrowprops=dict(arrowstyle="->", color=STAHL, lw=1.2))
ax.text(M_K*0.5, n_K-70, "steigende Belastung  $\\rightarrow$  Drehzahl sinkt, Schlupf steigt",
        fontsize=9.8, color=STAHL, ha="center")

ax.set_xlim(-1.0, M_K*1.12); ax.set_ylim(n_K-110, n_s+30)
ax.set_xlabel("Belastungsmoment  $M$  in  Nm")
ax.set_ylabel("Drehzahl  $n$  in  1/min")
ax.set_title("Belastungskennlinie  $n = f(M)$  (stabiler Betriebsbereich)",
             fontsize=14, fontweight="bold", pad=12, color=TINTE)
fig.tight_layout()
fig.savefig("bilder/kennlinie_belastung.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# BILD 3 : Strom-Drehzahl-Kennlinie  I = f(n)
# ----------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=130)
ax.plot(n, g["I1"], color=VIOLETT, lw=3.0, solid_capstyle="round", zorder=5,
        label="Staenderstrom $I_1(n)$")
ax.scatter([0], [I_A], s=80, color=WARNUNG, zorder=6, edgecolor="white", linewidth=1.5)
ax.annotate(f"Anlaufstrom $I_A$ = {I_A:.1f} A\n$\\approx${I_A/I_N:.1f}·$I_N$",
            (0, I_A), xytext=(150, I_A-1.4), fontsize=11, color=WARNUNG, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=WARNUNG, lw=1.3))
ax.scatter([n_N], [I_N], s=80, color=MESSWERT, zorder=6, edgecolor="white", linewidth=1.5)
ax.annotate(f"Nennstrom $I_N$ = {I_N:.1f} A", (n_N, I_N), xytext=(n_N-640, I_N+1.1),
            fontsize=10.8, color=MESSWERT, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=MESSWERT, lw=1.3))
I_0 = float(betriebsgroessen(np.array([1e-3]))["I1"][0])
ax.scatter([n_s], [I_0], s=70, color=STAHL, zorder=6, edgecolor="white", linewidth=1.4)
ax.annotate(f"Leerlaufstrom\n$I_0 \\approx$ {I_0:.1f} A", (n_s, I_0),
            xytext=(n_s-360, I_0+1.3), fontsize=10.2, color=STAHL,
            arrowprops=dict(arrowstyle="-", color=STAHL, lw=1.2))
ax.axvline(n_s, color=STAHL, ls=(0, (5, 4)), lw=1.2)
ax.set_xlim(-30, n_s+60); ax.set_ylim(0, I_A*1.12)
ax.set_xlabel("Drehzahl  $n$  in  1/min")
ax.set_ylabel("Staenderstrom  $I_1$  in  A")
ax.set_title("Strom-Drehzahl-Kennlinie  $I_1 = f(n)$",
             fontsize=14, fontweight="bold", pad=12, color=TINTE)
ax.legend(loc="upper right", frameon=True, framealpha=0.95, edgecolor=GITTER)
fig.tight_layout()
fig.savefig("bilder/kennlinie_strom.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# BILD 4 : Wirkungsgrad und Leistungsfaktor  eta, cos phi = f(P_ab)
# ----------------------------------------------------------------------
# nur stabiler Ast, P_ab > 0
mask = (n >= n_K) & (g["P_ab"] > 5)
Pab = g["P_ab"][mask]
order = np.argsort(Pab)
Pab = Pab[order]
eta = g["eta"][mask][order]
cphi = g["cosphi"][mask][order]
Ist = g["I1"][mask][order]

fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=130)
ax.plot(Pab, eta*100, color=MESSWERT, lw=3.0, solid_capstyle="round", zorder=5,
        label="Wirkungsgrad $\\eta$")
ax.plot(Pab, cphi*100, color=SPANNUNG, lw=3.0, solid_capstyle="round", zorder=5,
        label="Leistungsfaktor $\\cos\\varphi$")
ax.axvline(P_N, color=STAHL, ls=(0, (5, 4)), lw=1.3)
ax.annotate(f"$P_N$ = {P_N:.0f} W", (P_N, 12), xytext=(P_N-330, 12), fontsize=10.5,
            color=STAHL)
ax.scatter([P_N], [eta_N*100], s=80, color=MESSWERT, zorder=7, edgecolor="white", lw=1.5)
ax.annotate(f"$\\eta_N$ = {eta_N*100:.0f} %", (P_N, eta_N*100),
            xytext=(P_N*0.45, eta_N*100+5), fontsize=11, color=MESSWERT, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=MESSWERT, lw=1.3))
ax.scatter([P_N], [cos_N*100], s=80, color=SPANNUNG, zorder=7, edgecolor="white", lw=1.5)
ax.annotate(f"$\\cos\\varphi_N$ = {cos_N:.2f}", (P_N, cos_N*100),
            xytext=(P_N*0.42, cos_N*100-13), fontsize=11, color=SPANNUNG, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=SPANNUNG, lw=1.3))
ax.set_xlim(0, Pab.max()*1.02); ax.set_ylim(0, 100)
ax.set_xlabel("abgegebene Wellenleistung  $P_{ab}$  in  W")
ax.set_ylabel("$\\eta$  bzw.  $\\cos\\varphi$  in  %")
ax.set_title("Wirkungsgrad- und Leistungsfaktorkennlinie  $\\eta,\\ \\cos\\varphi = f(P_{ab})$",
             fontsize=13.5, fontweight="bold", pad=12, color=TINTE)
ax.legend(loc="lower right", frameon=True, framealpha=0.95, edgecolor=GITTER)
fig.tight_layout()
fig.savefig("bilder/kennlinie_wirkungsgrad.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# BILD 5 : Kloss'sche Gleichung -- M/M_K ueber s/s_K
# ----------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=130)
sr = np.linspace(0.02, 6.0, 800)          # s/s_K
M_rel = 2.0 / (sr + 1.0/sr)               # M/M_K nach Kloss
ax.plot(sr, M_rel, color=SPANNUNG, lw=3.0, solid_capstyle="round", zorder=5)
ax.axhline(1.0, color=WARNUNG, ls=(0, (5, 4)), lw=1.3)
ax.axvline(1.0, color=WARNUNG, ls=(0, (5, 4)), lw=1.3)
ax.scatter([1.0], [1.0], s=95, color=WARNUNG, zorder=7, edgecolor="white", lw=1.6)
ax.annotate("Kipppunkt\n$s = s_K$,  $M = M_K$", (1.0, 1.0), xytext=(1.5, 1.02),
            fontsize=11, color=WARNUNG, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=WARNUNG, lw=1.3))
ax.fill_between(sr[sr<=1.0], 0, M_rel[sr<=1.0], color=MESSWERT, alpha=0.08)
ax.fill_between(sr[sr>=1.0], 0, M_rel[sr>=1.0], color=WARNUNG, alpha=0.06)
ax.text(0.5, 0.30, "stabiler Ast\n$s < s_K$", fontsize=10.5, color=MESSWERT, ha="center")
ax.text(3.3, 0.30, "instabiler Ast\n$s > s_K$", fontsize=10.5, color=WARNUNG, ha="center")
ax.text(2.7, 0.86, r"$\dfrac{M}{M_K} = \dfrac{2}{\dfrac{s}{s_K}+\dfrac{s_K}{s}}$",
        fontsize=16, color=TINTE,
        bbox=dict(boxstyle="round,pad=0.45", fc="white", ec=GITTER, lw=1.2))
ax.set_xlim(0, 6.0); ax.set_ylim(0, 1.12)
ax.set_xlabel("bezogener Schlupf  $s / s_K$")
ax.set_ylabel("bezogenes Moment  $M / M_K$")
ax.set_title("Kloss'sche Gleichung – Drehmoment in Abhaengigkeit vom Schlupf",
             fontsize=14, fontweight="bold", pad=12, color=TINTE)
fig.tight_layout()
fig.savefig("bilder/kloss.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# BILD 6 : Leistungsfluss / Sankey-artiges Verlustdiagramm im Nennpunkt
# ----------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(9.2, 4.4), dpi=130)
ax.axis("off")
Pzu = float(gN["P_zu"][0]); Pcu1 = float(gN["P_cu1"][0]); Pfe = float(gN["P_fe"][0])
Pcu2 = float(gN["P_cu2"][0]); Preib = float(gN["P_reib"][0]); Pab = float(gN["P_ab"][0])
stationen = [
    ("$P_{zu}$\naufgenommen", Pzu, SPANNUNG),
    ("$-P_{Cu1}$\nStaender-Cu", Pcu1, WARNUNG),
    ("$-P_{Fe}$\nEisen", Pfe, WARNUNG),
    ("$-P_{Cu2}$\nLaeufer-Cu", Pcu2, WARNUNG),
    ("$-P_{Reib}$\nReibung", Preib, WARNUNG),
    ("$P_{ab}$\nWelle", Pab, MESSWERT),
]
x = 0.04
ax.text(0.5, 1.06, f"Leistungsbilanz im Nennpunkt  ($\\eta$ = {eta_N*100:.0f} %)",
        transform=ax.transAxes, ha="center", fontsize=14, fontweight="bold", color=TINTE)
running = Pzu
for i, (lab, val, col) in enumerate(stationen):
    if i == 0:
        h = 0.55; y0 = 0.18
        ax.add_patch(plt.Rectangle((x, y0), 0.13, h, color=SPANNUNG, alpha=0.9))
        ax.text(x+0.065, y0+h+0.05, lab, ha="center", va="bottom", fontsize=10.5, color=TINTE)
        ax.text(x+0.065, y0+h/2, f"{val:.0f} W", ha="center", va="center",
                fontsize=11, color="white", fontweight="bold")
        x += 0.175
    elif lab.startswith("$P_{ab}"):
        h = 0.55*Pab/Pzu; y0 = 0.18
        ax.add_patch(plt.Rectangle((x, y0), 0.13, h, color=MESSWERT, alpha=0.9))
        ax.text(x+0.065, y0+h+0.05, lab, ha="center", va="bottom", fontsize=10.5, color=TINTE)
        ax.text(x+0.065, y0+h/2, f"{val:.0f} W", ha="center", va="center",
                fontsize=10.5, color="white", fontweight="bold")
    else:
        running -= val
        ax.annotate("", xy=(x+0.02, 0.10), xytext=(x+0.02, 0.18),
                    arrowprops=dict(arrowstyle="->", color=col, lw=2.0))
        ax.text(x+0.02, 0.05, f"{lab}\n{val:.0f} W", ha="center", va="top",
                fontsize=9.2, color=col)
        x += 0.135
ax.set_xlim(0, 1); ax.set_ylim(0, 1)
fig.tight_layout()
fig.savefig("bilder/leistungsbilanz.png", dpi=130)
plt.close(fig)

# ----------------------------------------------------------------------
# Modellkennwerte als JSON fuer das JS-Frontend exportieren (Kontrolle)
# ----------------------------------------------------------------------
import json
kennwerte = dict(U=U, f=f, p=p, R1=R1, R2=R2, X=X, Xh=Xh, RFe=RFe, MR=MR,
                 n_s=n_s, omega_s=omega_s, s_K=round(s_K,4), M_K=round(M_K,3),
                 M_A=round(M_A,3), I_A=round(I_A,3), s_N=s_N, n_N=round(n_N,1),
                 M_N=round(M_N,3), I_N=round(I_N,3), P_N=round(P_N,1),
                 eta_N=round(eta_N,4), cos_N=round(cos_N,4))
with open("bilder/kennwerte.json", "w") as fp:
    json.dump(kennwerte, fp, indent=2)

print("\nAlle Bilder erzeugt:")
import os
for f_ in sorted(os.listdir("bilder")):
    print("  bilder/"+f_)
