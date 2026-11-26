import 'package:equatable/equatable.dart';

abstract class ElectionEvent extends Equatable {
  const ElectionEvent();

  @override
  List<Object?> get props => [];
}

class ElectionListRequested extends ElectionEvent {
  const ElectionListRequested();
}

class ElectionDetailsRequested extends ElectionEvent {
  final String electionId;

  const ElectionDetailsRequested(this.electionId);

  @override
  List<Object?> get props => [electionId];
}
