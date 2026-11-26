enum ElectionStatus {
  upcoming,
  ongoing,
  completed;

  static ElectionStatus fromJson(String? value) {
    switch (value?.toUpperCase()) {
      case 'UPCOMING':
        return ElectionStatus.upcoming;
      case 'ONGOING':
        return ElectionStatus.ongoing;
      case 'COMPLETED':
        return ElectionStatus.completed;
      default:
        throw FormatException('Unknown election status: $value');
    }
  }

  String toJson() => name.toUpperCase();
}

class ElectionModel {
  final String id;
  final String title;
  final String description;
  final String? imageUrl;
  final DateTime startAt;
  final DateTime endAt;
  final ElectionStatus status;
  final int candidateCount;
  final int totalVotes;
  final bool hasVoted;

  const ElectionModel({
    required this.id,
    required this.title,
    required this.description,
    this.imageUrl,
    required this.startAt,
    required this.endAt,
    required this.status,
    this.candidateCount = 0,
    this.totalVotes = 0,
    this.hasVoted = false,
  });

  factory ElectionModel.fromJson(Map<String, dynamic> json) {
    return ElectionModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      imageUrl: json['imageUrl'] as String?,
      startAt: DateTime.parse(json['startAt'] as String),
      endAt: DateTime.parse(json['endAt'] as String),
      status: ElectionStatus.fromJson(json['status'] as String?),
      candidateCount: json['candidateCount'] as int? ?? 0,
      totalVotes: json['totalVotes'] as int? ?? 0,
      hasVoted: json['hasVoted'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'imageUrl': imageUrl,
      'startAt': startAt.toIso8601String(),
      'endAt': endAt.toIso8601String(),
      'status': status.toJson(),
      'candidateCount': candidateCount,
      'totalVotes': totalVotes,
      'hasVoted': hasVoted,
    };
  }

  ElectionModel copyWith({
    String? id,
    String? title,
    String? description,
    String? imageUrl,
    DateTime? startAt,
    DateTime? endAt,
    ElectionStatus? status,
    int? candidateCount,
    int? totalVotes,
    bool? hasVoted,
  }) {
    return ElectionModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      startAt: startAt ?? this.startAt,
      endAt: endAt ?? this.endAt,
      status: status ?? this.status,
      candidateCount: candidateCount ?? this.candidateCount,
      totalVotes: totalVotes ?? this.totalVotes,
      hasVoted: hasVoted ?? this.hasVoted,
    );
  }
}
