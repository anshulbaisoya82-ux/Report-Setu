"""
Triage Agent Module for ReportSetu (ML 2).
Uses LangGraph to construct a state graph that systematically reviews
critical values, longitudinal trends, and clinical anomalies to assign
triage priority (Critical, Review, Stable) with an explainable one-line reason.
"""

from typing import List, Dict, Any, Optional, TypedDict
from langgraph.graph import StateGraph, START, END


class TriageState(TypedDict):
    patient_id: int
    insights: List[Dict[str, Any]]
    critical_findings: List[Dict[str, Any]]
    review_findings: List[Dict[str, Any]]
    priority: Optional[str]
    reason: Optional[str]
    execution_trace: List[str]


def check_critical_values_node(state: TriageState) -> Dict[str, Any]:
    """Step 1: Check for critical values that require immediate physician intervention."""
    insights = state.get("insights", [])
    trace = list(state.get("execution_trace", []))
    criticals = [
        ins for ins in insights
        if ins.get("severity") == "critical"
    ]
    
    if criticals:
        # Extract primary reason
        primary = criticals[0]
        explanation = primary.get("explanation", "Critical lab value detected")
        reason = explanation.split("(")[0].strip()
        trace.append(f"Step 1 (Check Criticals): Found {len(criticals)} critical value(s). Reason: {reason}")
        return {
            "critical_findings": criticals,
            "priority": "critical",
            "reason": reason,
            "execution_trace": trace
        }
    else:
        trace.append("Step 1 (Check Criticals): No critical thresholds breached. Advancing to trends.")
        return {
            "critical_findings": [],
            "execution_trace": trace
        }


def check_trends_node(state: TriageState) -> Dict[str, Any]:
    """Step 2: Check for significant longitudinal trends or unusual acute changes."""
    trace = list(state.get("execution_trace", []))
    
    # If already deemed critical, pass through
    if state.get("priority") == "critical":
        trace.append("Step 2 (Check Trends): Bypassed because patient is already Critical.")
        return {"execution_trace": trace}
        
    insights = state.get("insights", [])
    review_items = [
        ins for ins in insights
        if ins.get("severity") == "review"
    ]
    
    if review_items:
        # Prioritize longitudinal trends first
        trends = [i for i in review_items if i.get("type") == "trend"]
        primary = trends[0] if trends else review_items[0]
        
        code = primary.get("test_code", "")
        direction = primary.get("direction", "")
        explanation = primary.get("explanation", "")
        evidence = primary.get("evidence", [])
        
        # Count total reports across evidence
        n_reports = len(evidence)
        if n_reports < 2:
            # Look for corresponding trend insight for point count
            for t in trends:
                if t.get("test_code") == code:
                    n_reports = max(n_reports, len(t.get("evidence", [])))
                    
        if code == "HB" and direction == "falling":
            if len(evidence) >= 2:
                first_val = evidence[0]["value"]
                last_val = evidence[-1]["value"]
                pct = abs((last_val - first_val) / first_val * 100.0) if first_val else 0
                reason = f"Hb fell {pct:.0f}% across {n_reports} reports"
            else:
                reason = f"Haemoglobin falling trend across reports"
        elif code == "HBA1C" and direction == "rising":
            reason = f"HbA1c rising steadily across {n_reports} reports"
        elif primary.get("type") == "unusual_change":
            reason = explanation.split(":")[0].strip()
        else:
            reason = explanation.split("(")[0].strip()
            
        trace.append(f"Step 2 (Check Trends): Identified review-level finding. Reason: {reason}")
        return {
            "review_findings": review_items,
            "priority": "review",
            "reason": reason,
            "execution_trace": trace
        }
    else:
        trace.append("Step 2 (Check Trends): No adverse trends detected.")
        return {
            "review_findings": [],
            "execution_trace": trace
        }


def decide_triage_node(state: TriageState) -> Dict[str, Any]:
    """Step 3: Synthesize evidence into final triage outcome."""
    trace = list(state.get("execution_trace", []))
    current_priority = state.get("priority")
    current_reason = state.get("reason")
    
    if current_priority == "critical":
        final_priority = "critical"
        final_reason = current_reason or "Critical laboratory finding"
    elif current_priority == "review":
        final_priority = "review"
        final_reason = current_reason or "Requires physician review for observed trend"
    else:
        final_priority = "stable"
        insights = state.get("insights", [])
        info_items = [i for i in insights if i.get("type") == "out_of_range"]
        if info_items:
            final_reason = "Parameters largely stable; slight variation within acceptable limits"
        else:
            final_reason = "All laboratory parameters stable and within reference ranges"
            
    trace.append(f"Step 3 (Decide): Final triage priority={final_priority}. Reason: {final_reason}")
    return {
        "priority": final_priority,
        "reason": final_reason,
        "execution_trace": trace
    }


def build_triage_graph() -> StateGraph:
    """Builds and compiles the LangGraph state machine for triage."""
    workflow = StateGraph(TriageState)
    
    workflow.add_node("check_critical", check_critical_values_node)
    workflow.add_node("check_trends", check_trends_node)
    workflow.add_node("decide", decide_triage_node)
    
    workflow.add_edge(START, "check_critical")
    workflow.add_edge("check_critical", "check_trends")
    workflow.add_edge("check_trends", "decide")
    workflow.add_edge("decide", END)
    
    return workflow.compile()


# Compile graph once
triage_langgraph = build_triage_graph()


def triage(patient_id: int, insights: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Triage Agent entry point.
    
    Conforms strictly to Section 5:
    Input:
        patient_id: int
        insights: List of Insight dicts from analyze_patient
    Output:
        {
            "patient_id": int,
            "priority": "critical" | "review" | "stable",
            "reason": str
        }
    """
    initial_state: TriageState = {
        "patient_id": patient_id,
        "insights": insights,
        "critical_findings": [],
        "review_findings": [],
        "priority": None,
        "reason": None,
        "execution_trace": []
    }
    
    final_state = triage_langgraph.invoke(initial_state)
    
    return {
        "patient_id": patient_id,
        "priority": final_state.get("priority", "stable"),
        "reason": final_state.get("reason", "Stable laboratory parameters")
    }
